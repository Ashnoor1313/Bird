import express from 'express';
import multer from 'multer';
import path from 'path';
import prisma from '../prisma.js';
import { StockEngine } from '../services/StockEngine.js';
import { LedgerEngine } from '../services/LedgerEngine.js';
import { OcrEngine } from '../services/OcrEngine.js';
import { ProductMatcher } from '../services/ProductMatcher.js';
import { ImageProcessor } from '../services/ImageProcessor.js';
import { DocumentAIOrchestrator } from '../services/DocumentAIProvider.js';
import { SupplierMatcher } from '../services/SupplierMatcher.js';
import { InvoiceValidator } from '../services/InvoiceValidator.js';
import { ProductNormalizer } from '../services/ProductNormalizer.js';

import os from 'os';
import fs from 'fs';

const router = express.Router();

const getUploadDir = () => {
  const uploadDir = path.resolve('uploads');
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      return uploadDir;
    } catch (e) {
      return os.tmpdir();
    }
  }
  return uploadDir;
};

// Multer storage configuration for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    cb(null, `bill_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// Get purchases list
router.get('/', async (req, res) => {
  try {
    const { businessId, receivingLocationId, search } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };
    if (receivingLocationId && receivingLocationId !== 'ALL') {
      where.receivingLocationId = receivingLocationId;
    }
    if (search) {
      const q = search.trim();
      where.OR = [
        { purchaseNo: { contains: q } },
        { supplierName: { contains: q } },
        { billNo: { contains: q } },
      ];
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        receivingLocation: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// SCAN BILL OCR ENDPOINT (10-Stage AI Document Extraction & Reconciliation Pipeline)
router.post('/scan', upload.single('billFile'), async (req, res) => {
  try {
    const { businessId, locationId, receivingLocationId, geminiApiKey } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Bill file/image is required' });
    }

    const imagePath = req.file.path;
    const targetLoc = locationId || receivingLocationId || null;

    // STAGE 1: Image Quality Assessment
    const qualityReport = await ImageProcessor.analyzeImageQuality(imagePath);

    // STAGE 2 & 3: Document AI & Layout Extraction (via DocumentAIOrchestrator)
    const docResult = await DocumentAIOrchestrator.processDocument(imagePath, req.file.mimetype, { geminiApiKey });

    // STAGE 4: Store-Isolated Supplier Matching
    const supplierMatch = await SupplierMatcher.matchSupplier(
      docResult.supplier,
      businessId,
      targetLoc
    );

    // STAGE 5: Product Database Reconciliation
    const rawItems = (docResult.items || []).map(item => {
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

    const matchedItems = await ProductMatcher.matchAllItems(rawItems, businessId);

    // STAGE 6 & 7: Mathematical & GST Validation Engine
    const validationResults = InvoiceValidator.validateInvoice({
      ...docResult,
      items: matchedItems,
    });

    // Calculate Overall Document Extraction Confidence Score
    const itemConfidences = matchedItems.map(i => i.confidence || 75);
    const avgItemConfidence = itemConfidences.length > 0
      ? Math.round(itemConfidences.reduce((a, b) => a + b, 0) / itemConfidences.length)
      : 50;

    const overallConfidence = Math.min(
      docResult.confidence?.overall || 85,
      avgItemConfidence
    );

    res.json({
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
      buyerName: docResult.buyer?.name || 'Store Inventory',
      items: matchedItems,
      subtotal: docResult.subtotal || validationResults.calculatedSubtotal,
      discount: docResult.discount || 0,
      cgst: docResult.cgst || 0,
      sgst: docResult.sgst || 0,
      igst: docResult.igst || 0,
      totalTax: docResult.totalTax || 0,
      grandTotal: docResult.grandTotal || validationResults.calculatedSubtotal,
      confidence: {
        ...docResult.confidence,
        overall: overallConfidence,
      },
      validation: validationResults,
      imageQuality: qualityReport,
      imagePath,
      provider: docResult.provider || 'AI_Document_Parser',
      rawText: docResult.rawText || '',
    });
  } catch (err) {
    console.error('AI Document Extraction failure:', err);
    res.status(500).json({ error: 'Failed to process bill image via AI Document Extraction engine' });
  }
});

// CREATE PURCHASE BILL (Connected Core Engine with Store Isolation)
router.post('/', async (req, res) => {
  try {
    const {
      businessId,
      receivingLocationId,
      supplierId,
      supplierName,
      billNo,
      imagePath,
      items, // [{ productId, productName, model, quality, variant, quantity, unitPrice, discount, gstPercentage }]
      discount = 0,
      paidAmount = 0,
      paymentMethod = 'CASH',
      notes,
    } = req.body;

    let effectiveLocationId = receivingLocationId;
    if (!effectiveLocationId || effectiveLocationId === 'ALL') {
      const defaultLoc = await prisma.location.findFirst({
        where: { businessId, type: 'GODOWN' },
      }) || await prisma.location.findFirst({
        where: { businessId, type: 'STORE' },
      }) || await prisma.location.findFirst({
        where: { businessId },
      });
      if (defaultLoc) effectiveLocationId = defaultLoc.id;
    }

    if (!businessId || !effectiveLocationId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'businessId, receivingLocationId (store ID), and non-empty items array are required' });
    }

    const resolvedLocationId = effectiveLocationId;
    const location = await prisma.location.findUnique({ where: { id: resolvedLocationId } });
    if (!location) return res.status(400).json({ error: 'Invalid receivingLocationId' });

    // Ensure supplier belongs to the SAME business
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return res.status(400).json({ error: 'Supplier not found' });
      }
      if (supplier.businessId !== businessId) {
        return res.status(400).json({ error: 'Supplier belongs to a different business' });
      }
    }

    const purchaseNo = `PUR-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      const purchaseItemsData = [];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        const price = parseFloat(item.unitPrice);
        const itemDiscount = parseFloat(item.discount || 0);
        const lineSubtotal = qty * price - itemDiscount;
        const lineTotal = lineSubtotal;

        subtotal += lineSubtotal;

        purchaseItemsData.push({
          productId: item.productId || null,
          productName: item.productName,
          model: item.model,
          quality: item.quality,
          variant: item.variant,
          quantity: qty,
          unitPrice: price,
          discount: itemDiscount,
          gstPercentage: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: lineTotal,
        });
      }

      const totalPurchase = subtotal - parseFloat(discount);
      const paid = Math.min(totalPurchase, parseFloat(paidAmount || 0));
      const due = Math.max(0, totalPurchase - paid);

      // Create Purchase record
      const purchase = await tx.purchase.create({
        data: {
          businessId,
          receivingLocationId: resolvedLocationId,
          purchaseNo,
          supplierId: supplierId || null,
          supplierName: supplierName || 'Wholesale Supplier',
          billNo,
          imagePath,
          subtotal,
          discount: parseFloat(discount),
          cgst: totalCgst,
          sgst: totalSgst,
          igst: 0,
          total: totalPurchase,
          paidAmount: paid,
          dueAmount: due,
          paymentMethod,
          notes,
          items: {
            create: purchaseItemsData,
          },
        },
        include: { items: true },
      });

      // 1. INCREASE STOCK FOR EACH PURCHASED PRODUCT IN RECEIVING LOCATION
      for (const item of items) {
        if (item.productId) {
          await StockEngine.recordMovement(
            {
              businessId,
              productId: item.productId,
              locationId: resolvedLocationId,
              type: 'PURCHASE',
              quantity: parseInt(item.quantity, 10),
              reference: purchaseNo,
              note: `Purchase ${purchaseNo}`,
            },
            tx
          );
        } else {
          // Optionally create new product if not matched during OCR confirmation!
          const newProduct = await tx.product.create({
            data: {
              businessId,
              name: item.productName,
              model: item.model || 'Universal',
              quality: item.quality || 'OEM',
              variant: item.variant,
              purchasePrice: parseFloat(item.unitPrice),
              sellingPrice: Math.round(parseFloat(item.unitPrice) * 1.3), // Smart default 30% margin
              currentStock: 0,
              goodStock: 0,
            },
          });
          await StockEngine.recordMovement(
            {
              businessId,
              productId: newProduct.id,
              locationId: resolvedLocationId,
              type: 'PURCHASE',
              quantity: parseInt(item.quantity, 10),
              reference: purchaseNo,
              note: `New Product created from Purchase ${purchaseNo}`,
            },
            tx
          );
        }
      }

      // 2. UPDATE SUPPLIER KHATA
      if (supplierId) {
        await LedgerEngine.recordSupplierTransaction(
          {
            businessId,
            locationId: resolvedLocationId,
            supplierId,
            type: 'PURCHASE',
            reference: purchaseNo,
            amount: totalPurchase,
            note: `Purchase ${purchaseNo}`,
          },
          tx
        );

        if (paid > 0) {
          await LedgerEngine.recordSupplierTransaction(
            {
              businessId,
              locationId: resolvedLocationId,
              supplierId,
              type: 'PAYMENT',
              reference: `PAY-${purchaseNo}`,
              amount: paid,
              note: `Payment for purchase ${purchaseNo}`,
            },
            tx
          );
        }
      }

      // 3. RECORD MONEY PAID
      if (paid > 0) {
        await tx.payment.create({
          data: {
            businessId,
            locationId: resolvedLocationId,
            type: 'PAY',
            partyType: 'SUPPLIER',
            supplierId: supplierId || null,
            partyName: supplierName || 'Supplier',
            amount: paid,
            paymentMethod,
            reference: purchaseNo,
            notes: `Paid on purchase ${purchaseNo}`,
          },
        });

        await LedgerEngine.updateAccountBalance({ businessId, locationId: resolvedLocationId, method: paymentMethod, amount: paid, isIncoming: false }, tx);
      }

      return purchase;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Create Purchase Error:', err);
    res.status(400).json({ error: err.message || 'Failed to record purchase' });
  }
});

export default router;
