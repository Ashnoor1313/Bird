import path from 'path';
import fs from 'fs';
import prisma from '../prisma.js';
import { ImageProcessor } from './ImageProcessor.js';
import { DocumentAIOrchestrator } from './DocumentAIProvider.js';
import { SupplierMatcher } from './SupplierMatcher.js';
import { ProductMatcher } from './ProductMatcher.js';
import { InvoiceValidator } from './InvoiceValidator.js';
import { ProductNormalizer } from './ProductNormalizer.js';

class OcrJobStore {
  constructor() {
    this.jobs = new Map();
    // Run garbage collection every 10 minutes to evict jobs older than 1 hour
    setInterval(() => this.cleanupOldJobs(), 10 * 60 * 1000).unref();
  }

  cleanupOldJobs() {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > ONE_HOUR) {
        if (job.filePath && fs.existsSync(job.filePath)) {
          try { fs.unlinkSync(job.filePath); } catch (e) {}
        }
        this.jobs.delete(id);
      }
    }
  }

  createJob(file, params = {}) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const job = {
      id: jobId,
      type: params.type || 'PURCHASE',
      status: 'UPLOADING',
      step: 1,
      percent: 15,
      message: 'Uploading...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      filePath: file.path,
      mimetype: file.mimetype,
      params,
      result: null,
      error: null,
    };

    this.jobs.set(jobId, job);

    // Run async background OCR processing without blocking HTTP request
    setImmediate(() => this.processJobAsync(jobId));

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    Object.assign(job, updates, { updatedAt: Date.now() });
    return job;
  }

  async processJobAsync(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const { filePath, mimetype, params } = job;
      const { businessId, locationId, receivingLocationId, categoryId, geminiApiKey } = params;

      let targetBusinessId = businessId;
      if (!targetBusinessId || targetBusinessId === 'undefined' || targetBusinessId === 'null') {
        const firstBiz = await prisma.business.findFirst();
        targetBusinessId = firstBiz?.id;
      }

      const targetLoc = locationId || receivingLocationId || null;

      // STAGE 2: Reading bill (Analyzing image quality & layout)
      this.updateJob(jobId, {
        status: 'READING',
        step: 2,
        percent: 35,
        message: 'Reading bill...',
      });

      const qualityReport = await ImageProcessor.analyzeImageQuality(filePath);

      // STAGE 3: Processing (AI Multimodal & OCR parsing)
      this.updateJob(jobId, {
        status: 'PROCESSING',
        step: 3,
        percent: 65,
        message: 'Processing...',
      });

      const docResult = await DocumentAIOrchestrator.processDocument(filePath, mimetype, { geminiApiKey });

      // STAGE 4: Preparing result (Catalog reconciliation & validation)
      this.updateJob(jobId, {
        status: 'PREPARING',
        step: 4,
        percent: 90,
        message: 'Preparing result...',
      });

      if (job.type === 'SALE') {
        // Sales bill flow
        const rawItems = (docResult.items || []).map((item) => {
          const rawText = item.description || item.productName || 'Mobile Part';
          const cleanName = ProductNormalizer.stripNoiseWords(rawText) || rawText;
          return {
            productName: cleanName,
            quantity: parseInt(item.quantity, 10) || 1,
            unitPrice: parseFloat(item.unitPrice || 0),
            total: parseFloat(item.total || (item.quantity * item.unitPrice)),
          };
        });

        const matchedItems = await ProductMatcher.matchAllItems(
          rawItems,
          targetBusinessId,
          categoryId || null
        );

        const saleResult = {
          customerName: docResult.customer?.name || null,
          customerPhone: docResult.customer?.phone || null,
          billNo: docResult.invoiceNumber || `BILL-${Math.floor(1000 + Math.random() * 9000)}`,
          date: docResult.invoiceDate || new Date().toISOString().split('T')[0],
          items: matchedItems,
          rawText: docResult.rawText || '',
          imageQuality: qualityReport,
          confidence: docResult.confidence || { overall: 85 },
        };

        this.updateJob(jobId, {
          status: 'COMPLETED',
          step: 5,
          percent: 100,
          message: 'Completed',
          result: saleResult,
        });
      } else {
        // Purchase / Stock intake flow
        const supplierMatch = await SupplierMatcher.matchSupplier(
          docResult.supplier,
          targetBusinessId,
          targetLoc
        );

        const rawItems = (docResult.items || []).map((item) => {
          const rawText = item.description || item.productName || 'Spare Part Item';
          const cleanName = ProductNormalizer.stripNoiseWords(rawText) || rawText;
          return {
            productName: cleanName,
            quantity: parseInt(item.quantity, 10) || 1,
            unitPrice: parseFloat(item.unitPrice || 0),
            discount: parseFloat(item.discount || 0),
            gstPercentage: parseFloat(item.taxRate || 0),
            hsn: item.hsn || '',
            unit: item.unit || 'PCS',
            total: parseFloat(item.total || (item.quantity * item.unitPrice)),
          };
        });

        const matchedItems = await ProductMatcher.matchAllItems(rawItems, targetBusinessId);

        const validationResults = InvoiceValidator.validateInvoice({
          ...docResult,
          items: matchedItems,
        });

        const itemConfidences = matchedItems.map((i) => i.confidence || 75);
        const avgItemConfidence = itemConfidences.length > 0
          ? Math.round(itemConfidences.reduce((a, b) => a + b, 0) / itemConfidences.length)
          : 50;

        const overallConfidence = Math.min(
          docResult.confidence?.overall || 85,
          avgItemConfidence
        );

        const purchaseResult = {
          documentType: docResult.documentType || 'PURCHASE_INVOICE',
          supplier: {
            extractedName: docResult.supplier?.name || null,
            gstin: docResult.supplier?.gstin || null,
            phone: docResult.supplier?.phone || null,
            matchedSupplierId: supplierMatch.matchedSupplier ? supplierMatch.matchedSupplier.id : null,
            matchedSupplierName: supplierMatch.matchedSupplier ? supplierMatch.matchedSupplier.name : (docResult.supplier?.name || 'Wholesale Supplier'),
            confidence: supplierMatch.confidence,
          },
          invoiceNumber: docResult.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
          invoiceDate: docResult.invoiceDate || new Date().toISOString().split('T')[0],
          items: matchedItems,
          imageQuality: qualityReport,
          confidence: {
            overall: overallConfidence,
            ocrExtraction: docResult.confidence?.overall || 85,
            databaseMatch: avgItemConfidence,
            supplierMatch: supplierMatch.confidence,
          },
          validation: validationResults,
          rawText: docResult.rawText || '',
        };

        this.updateJob(jobId, {
          status: 'COMPLETED',
          step: 5,
          percent: 100,
          message: 'Completed',
          result: purchaseResult,
        });
      }
    } catch (err) {
      console.error(`[OcrJobService] Job ${jobId} failed:`, err);
      this.updateJob(jobId, {
        status: 'FAILED',
        step: 0,
        message: 'OCR failed — Retry',
        error: err.message || 'Failed to process document',
      });
    }
  }
}

export const OcrJobService = new OcrJobStore();
export default OcrJobService;
