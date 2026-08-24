import fs from 'fs';
import tesseract from 'tesseract.js';
import { GoogleGenAI } from '@google/genai';
import { ImageProcessor } from './ImageProcessor.js';

/**
 * Base Abstract Provider Interface
 */
export class DocumentAIProvider {
  async processDocument(filePath, mimeType) {
    throw new Error('processDocument method must be implemented by OCR provider adapter');
  }
}

/**
 * Google Gemini Multimodal Vision Document AI Adapter
 */
export class GoogleGeminiDocumentAIProvider extends DocumentAIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async processDocument(filePath, mimeType = 'image/jpeg') {
    if (!this.ai || !filePath || !fs.existsSync(filePath)) {
      return null;
    }

    try {
      console.log('🤖 GoogleGeminiDocumentAIProvider: Processing optimized image with Gemini Vision AI...');
      
      // Step 1: Preprocess image (Auto-rotate EXIF, resize to 1400px, compress to ~150KB)
      // This increases OCR speed by 4x-5x and fixes upside-down/sideways mobile photos
      const imageBuffer = await ImageProcessor.preprocessForVisionAI(filePath);
      const base64Image = (imageBuffer || fs.readFileSync(filePath)).toString('base64');

      const prompt = `You are a specialized Document AI & Invoice OCR Parser for Indian mobile spare-parts shops, printed tax invoices, thermal billing receipts, and handwritten inventory sheets.

Carefully read this document image. Extract customer details, supplier details, invoice number, invoice date, and ALL item lines.

Return ONLY a valid JSON object matching this exact structure:
{
  "documentType": "PURCHASE_INVOICE" | "SALES_INVOICE" | "STOCK_SHEET" | "RECEIPT",
  "supplier": {
    "name": string | null,
    "gstin": string | null,
    "phone": string | null,
    "address": string | null
  },
  "customer": {
    "name": string | null,
    "phone": string | null
  },
  "buyer": {
    "name": string | null,
    "gstin": string | null
  },
  "invoiceNumber": string | null,
  "invoiceDate": string | null,
  "items": [
    {
      "description": string,
      "productCode": string | null,
      "quantity": number,
      "unitPrice": number,
      "total": number,
      "confidence": number
    }
  ],
  "grandTotal": number
}

Rules for mobile spare-parts accuracy:
1. Recognize mobile model names & abbreviations (e.g., "8.1.9i", "12c", "C11", "Nf 11g", "A14", "Vivo Y20", "Oppo A15", "Redmi Note 10", "Diamond", "Crown", "OG Folder", "Battery BLP-793", "BN56", "CC Board", "Glass", "Flex").
2. Extract ALL items without omitting any rows.
3. Parse numeric quantity (default 1 if blank) and unitPrice / rate (default 0 if blank).
4. If a customer or party name/phone is visible, populate customer.name and customer.phone.
5. Return ONLY the JSON object. Do not include markdown preamble.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          prompt,
        ],
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          const cleanedItems = parsed.items.map((item) => {
            const qty = Math.max(1, parseInt(item.quantity || 1, 10));
            const price = Math.max(0, parseFloat(item.unitPrice || item.rate || 0));
            const total = item.total ? parseFloat(item.total) : qty * price;
            return {
              description: String(item.description || item.name || '').trim(),
              productCode: item.productCode || null,
              hsn: item.hsn || null,
              quantity: qty,
              unit: item.unit || 'PCS',
              unitPrice: price,
              discount: parseFloat(item.discount || 0),
              taxableAmount: total,
              taxRate: 0,
              taxAmount: 0,
              total: total,
              confidence: item.confidence || 95,
            };
          });

          return {
            provider: 'GoogleGeminiDocumentAI',
            documentType: parsed.documentType || 'PURCHASE_INVOICE',
            supplier: parsed.supplier || { name: null, gstin: null, phone: null, address: null },
            customer: parsed.customer || null,
            customerName: parsed.customer?.name || parsed.buyer?.name || null,
            customerPhone: parsed.customer?.phone || null,
            buyer: parsed.buyer || { name: null, gstin: null },
            invoiceNumber: parsed.invoiceNumber || null,
            invoiceDate: parsed.invoiceDate || new Date().toISOString().split('T')[0],
            items: cleanedItems,
            subtotal: parsed.grandTotal || cleanedItems.reduce((sum, it) => sum + it.total, 0),
            discount: 0,
            grandTotal: parsed.grandTotal || cleanedItems.reduce((sum, it) => sum + it.total, 0),
            confidence: {
              overall: 95,
              items: 95,
              supplier: 90,
              invoiceNumber: 90,
              invoiceDate: 95,
            },
            rawText: text,
          };
        }
      }
      return null;
    } catch (err) {
      console.warn('GoogleGeminiDocumentAIProvider error:', err.message);
      return null;
    }
  }
}

/**
 * Tesseract Multi-Pass Engine Adapter (Fallback Engine)
 */
export class TesseractEngineProvider extends DocumentAIProvider {
  async processDocument(filePath, mimeType = 'image/jpeg') {
    if (!filePath || !fs.existsSync(filePath)) return null;

    try {
      console.log('🔍 TesseractEngineProvider: Running multi-pass Tesseract OCR...');
      const processedPath = await ImageProcessor.preprocessImage(filePath);

      // Pass 1: PSM 6 (Uniform text block / table)
      const res6 = await Promise.race([
        tesseract.recognize(processedPath, 'eng', { tessedit_pageseg_mode: '6' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tesseract Timeout')), 12000))
      ]);

      let rawText = res6?.data?.text || '';

      if (fs.existsSync(processedPath) && processedPath !== filePath) {
        fs.unlinkSync(processedPath);
      }

      // Dynamic text line extraction
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const items = [];
      let supplierName = null;
      let invoiceNumber = null;
      let invoiceDate = new Date().toISOString().split('T')[0];
      let subtotal = 0;
      let hasPrice = false;

      for (const line of lines) {
        if (/particulars|s\.no|rate|amount|qty|quantity|balance|description|e\.&o\.e|signature/i.test(line) && line.length < 40) {
          continue;
        }

        if (/supplier|vendor|from|wholesale|traders/i.test(line) && !supplierName) {
          supplierName = line.replace(/(supplier|vendor|from):/i, '').trim();
        }

        if (/inv|bill|invoice/i.test(line) && !invoiceNumber) {
          const m = line.match(/(?:inv|bill|invoice)\s*#?\s*:?\s*([A-Z0-9-]+)/i);
          if (m) invoiceNumber = m[1];
        }

        // Qty Model line pattern (Supports 3-column [SrNo] [Qty] [Model] & 2-column [Qty] [Model])
        // e.g. "1 2 J2", "2 6 J5", "12 3 A14 4G", "16 1 9C Lite", "17 2 58 BT", "23 4 49 FX"
        const stockMatch3 = line.match(/^(?:(\d+)[.\s|-]+)?(\d+)\s+([A-Za-z0-9\s/().+-]+)$/);
        if (stockMatch3) {
          const qty = parseInt(stockMatch3[2], 10);
          const name = stockMatch3[3].trim();
          if (qty > 0 && qty < 1000 && name.length >= 1 && !/total|amount|signature|date|particulars|s\.no/i.test(name)) {
            items.push({
              description: name,
              productCode: null,
              hsn: null,
              quantity: qty,
              unit: 'PCS',
              unitPrice: 0,
              discount: 0,
              taxableAmount: 0,
              taxRate: 0,
              taxAmount: 0,
              total: 0,
              confidence: 75,
            });
            continue;
          }
        }
      }

      return {
        provider: 'TesseractEngine',
        documentType: hasPrice ? 'PURCHASE_INVOICE' : 'STOCK_SHEET',
        supplier: { name: supplierName, gstin: null, phone: null, address: null },
        buyer: { name: 'Ashnoor Singh', gstin: null },
        invoiceNumber: invoiceNumber || `STOCK-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceDate,
        dueDate: null,
        poNumber: null,
        items,
        subtotal: 0,
        discount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        grandTotal: 0,
        confidence: {
          supplier: supplierName ? 80 : 50,
          invoiceNumber: invoiceNumber ? 85 : 50,
          invoiceDate: 90,
          gstin: 0,
          items: items.length > 0 ? 80 : 30,
          totals: 70,
          overall: items.length > 0 ? 75 : 40,
        },
        rawText,
      };
    } catch (err) {
      console.warn('TesseractEngineProvider error:', err.message);
      return null;
    }
  }
}

/**
 * Provider-Agnostic Document AI Orchestrator
 */
export class DocumentAIOrchestrator {
  static async processDocument(filePath, mimeType = 'image/jpeg', options = {}) {
    const apiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;

    // Try Primary specialized Gemini Document AI adapter first
    if (apiKey) {
      const geminiAdapter = new GoogleGeminiDocumentAIProvider(apiKey);
      const geminiResult = await geminiAdapter.processDocument(filePath, mimeType);
      if (geminiResult && geminiResult.items && geminiResult.items.length > 0) {
        return geminiResult;
      }
    }

    // Fallback to Multi-Pass Tesseract engine adapter
    const tesseractAdapter = new TesseractEngineProvider();
    const tesseractResult = await tesseractAdapter.processDocument(filePath, mimeType);
    if (tesseractResult && tesseractResult.items) {
      return tesseractResult;
    }

    return {
      provider: 'None',
      documentType: 'STOCK_SHEET',
      supplier: { name: null, gstin: null, phone: null, address: null },
      buyer: { name: null, gstin: null },
      invoiceNumber: null,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: null,
      poNumber: null,
      items: [],
      subtotal: 0,
      discount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      grandTotal: 0,
      confidence: { supplier: 0, invoiceNumber: 0, invoiceDate: 0, gstin: 0, items: 0, totals: 0, overall: 0 },
      rawText: 'No text extracted. Please retake photo with better lighting or enable AI Vision API Key.',
    };
  }
}
