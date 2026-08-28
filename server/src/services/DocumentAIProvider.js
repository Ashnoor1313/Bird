import fs from 'fs';
import path from 'path';
import os from 'os';
import tesseractPkg from 'tesseract.js';
import pdfParse from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import { ImageProcessor } from './ImageProcessor.js';
import { ProductNormalizer } from './ProductNormalizer.js';

/**
 * Tesseract ESM compatibility helper with Production Cloud /tmp caching & worker resiliency
 */
export const recognizeOCR = async (imagePath, lang = 'eng', options = {}) => {
  const t = tesseractPkg.default || tesseractPkg;
  const fn = t.recognize || (typeof t === 'function' ? t : null);
  if (typeof fn === 'function') {
    const prodOptions = {
      cachePath: os.tmpdir(),
      gzip: true,
      ...options,
    };
    return await fn(imagePath, lang, prodOptions);
  }
  throw new Error('Tesseract OCR recognize engine function unavailable');
};

/**
 * Validate Google Gemini API Key format
 */
export function isValidGeminiApiKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return trimmed.length >= 10 && !trimmed.includes('YOUR_API_KEY') && !trimmed.includes('your_key_here');
}

/**
 * Base Abstract Provider Interface
 */
export class DocumentAIProvider {
  async processDocument(filePath, mimeType) {
    throw new Error('processDocument method must be implemented by OCR provider adapter');
  }
}

/**
 * Google Gemini Multimodal Vision Document AI Adapter (SDK + REST Dual-Strategy)
 */
export class GoogleGeminiDocumentAIProvider extends DocumentAIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey ? apiKey.trim() : null;
    if (this.apiKey && isValidGeminiApiKey(this.apiKey)) {
      try {
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (e) {
        console.warn('GoogleGenAI constructor notice:', e.message);
      }
    }
  }

  async processDocument(filePath, mimeType = 'image/jpeg') {
    if (!this.apiKey || !filePath || !fs.existsSync(filePath)) {
      return null;
    }

    try {
      console.log('🤖 GoogleGeminiDocumentAIProvider: Processing document with Gemini Vision AI...');
      
      const isPdf = mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf');
      
      let base64Data = '';
      let targetMimeType = 'image/jpeg';

      if (isPdf) {
        base64Data = fs.readFileSync(filePath).toString('base64');
        targetMimeType = 'application/pdf';
      } else {
        const prep = await ImageProcessor.preprocessForVisionAI(filePath);
        if (prep && prep.buffer) {
          base64Data = prep.buffer.toString('base64');
          targetMimeType = prep.mimeType || 'image/jpeg';
        } else {
          base64Data = fs.readFileSync(filePath).toString('base64');
          targetMimeType = mimeType || 'image/jpeg';
        }
      }

      const prompt = `You are a specialized Document AI & Invoice OCR Parser for Indian mobile spare-parts shops, printed tax invoices, thermal billing receipts, and handwritten inventory sheets.

Carefully read this document image / PDF. Extract customer details, supplier details, invoice number, invoice date, and ALL item lines.

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

      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      let extractedText = null;

      // STRATEGY 1: Native REST API with strict application/json response
      for (const modelName of modelsToTry) {
        try {
          const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
          const restPayload = {
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: targetMimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json',
            },
          };

          const restRes = await fetch(restUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restPayload),
          });

          if (restRes.ok) {
            const data = await restRes.json();
            const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              extractedText = candidateText;
              break;
            }
          } else {
            const errData = await restRes.text();
            console.warn(`Gemini REST model ${modelName} returned status ${restRes.status}:`, errData.slice(0, 150));
          }
        } catch (rErr) {
          console.warn(`Gemini REST request for ${modelName} notice:`, rErr.message);
        }
      }

      // STRATEGY 2: @google/genai SDK fallback if REST did not return
      if (!extractedText && this.ai) {
        for (const modelName of modelsToTry) {
          try {
            const response = await this.ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  inlineData: {
                    mimeType: targetMimeType,
                    data: base64Data,
                  },
                },
                prompt,
              ],
            });
            if (response && response.text) {
              extractedText = response.text;
              break;
            }
          } catch (mErr) {
            console.warn(`Gemini SDK model ${modelName} notice:`, mErr.message);
          }
        }
      }

      if (!extractedText) {
        return null;
      }

      const cleanJsonText = extractedText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
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
            rawText: extractedText,
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
 * Enhanced Multi-Pattern Text & Table Parser (Used by PDF & Tesseract Fallback Engine)
 */
export function parseExtractedText(rawText) {
  const lines = (rawText || '').split('\n').map(l => l.trim()).filter(Boolean);

  let supplierName = null;
  let customerName = null;
  let customerPhone = null;
  let invoiceNumber = null;
  let invoiceDate = new Date().toISOString().split('T')[0];
  const items = [];
  let hasPrice = false;

  for (const line of lines) {
    // Skip headers and structural noise
    if (/particulars|s\.no|rate|amount|qty|quantity|balance|description|signature|e\.&o\.e|taxable|hsn|gst/i.test(line) && line.length < 45) {
      continue;
    }

    // 1. Detect Supplier Name
    if (/\b(?:supplier|vendor|from|wholesale|traders|mobiles|distributor|enterprises)\b/i.test(line) && !supplierName) {
      const match = line.match(/\b(?:supplier|vendor|from|wholesale|traders|mobiles|distributor)\b\s*[:#-]?\s*([A-Za-z0-9\s.&'-]+)/i);
      if (match && match[1] && !/particulars|date|invoice|sl\.?\s*no/i.test(match[1])) {
        supplierName = match[1].trim();
      }
    }

    // 2. Detect Customer Name / Phone
    if (/\b(?:customer|client|buyer|party|m\/s|bill to)\b\s*[:#-]?\s*([A-Za-z0-9\s.]+)/i.test(line) && !customerName) {
      const match = line.match(/\b(?:customer|client|buyer|party|m\/s|bill to)\b\s*[:#-]?\s*([A-Za-z0-9\s.]+)/i);
      if (match && match[1] && match[1].trim().length > 2 && !/invoice|date|number|particulars/i.test(match[1])) {
        customerName = match[1].trim();
      }
    }

    const phoneMatch = line.match(/(?:\+91[\s-]*)?([6-9]\d{9})\b/);
    if (phoneMatch && !customerPhone) {
      customerPhone = phoneMatch[1];
    }

    // 3. Detect Invoice Number
    if (/(?:inv|bill|invoice|receipt|sl\.?\s*no)\s*(?:no\.?|num\.?)?\s*[:#-]?\s*\b([A-Z0-9/-]{3,})\b/i.test(line) && !invoiceNumber) {
      const m = line.match(/(?:inv|bill|invoice|receipt|sl\.?\s*no)\s*(?:no\.?|num\.?)?\s*[:#-]?\s*\b([A-Z0-9/-]{3,})\b/i);
      if (m && m[1] && !/invoice|receipt|tax|bill|sheet/i.test(m[1])) invoiceNumber = m[1];
    }

    // 4. Detect Date
    const dateMatch = line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/);
    if (dateMatch && !invoiceDate) {
      invoiceDate = dateMatch[1];
    }

    // --- ITEM LINE EXTRACTION PATTERNS ---

    // PATTERN A: Math Verification Strategy (Qty * Rate = Total)
    const numbers = [];
    const numRegex = /\b\d+(?:\.\d+)?\b/g;
    let numMatch;
    while ((numMatch = numRegex.exec(line)) !== null) {
      numbers.push({ val: parseFloat(numMatch[0]), raw: numMatch[0], index: numMatch.index });
    }

    let parsedItem = null;

    if (numbers.length >= 2) {
      for (let i = 0; i < numbers.length; i++) {
        for (let j = 0; j < numbers.length; j++) {
          if (i === j) continue;
          for (let k = 0; k < numbers.length; k++) {
            if (k === i || k === j) continue;
            const qty = numbers[i].val;
            const rate = numbers[j].val;
            const amt = numbers[k].val;

            if (qty > 0 && qty <= 1000 && rate > 0 && Math.abs(qty * rate - amt) <= Math.max(2, amt * 0.05)) {
              let nameText = line;
              [numbers[i], numbers[j], numbers[k]].forEach(n => {
                const escaped = String(n.raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                nameText = nameText.replace(new RegExp(`\\b${escaped}\\b`, 'g'), ' ');
              });
              const cleanName = ProductNormalizer.stripNoiseWords(nameText) || nameText || 'Spare Part Item';

              if (cleanName.length >= 2 && !/subtotal|total|amount|signature|date|particulars/i.test(cleanName)) {
                parsedItem = {
                  description: cleanName,
                  productCode: null,
                  hsn: null,
                  quantity: Math.round(qty),
                  unit: 'PCS',
                  unitPrice: rate,
                  discount: 0,
                  taxableAmount: amt,
                  taxRate: 0,
                  taxAmount: 0,
                  total: amt,
                  confidence: 90,
                };
                hasPrice = true;
                break;
              }
            }
          }
          if (parsedItem) break;
        }
        if (parsedItem) break;
      }
    }

    // PATTERN B: Standard Table Line [SrNo] Description Qty UnitPrice Total OR Description Qty UnitPrice
    if (!parsedItem) {
      const tableMatch = line.match(/^(?:(\d+)[.\s|-]+)?([A-Za-z0-9\s/().+–-]+?)\s+(\d+)\s+(?:pcs|pc|nos|unit)?\s*@?\s*(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?$/i);
      if (tableMatch) {
        const name = tableMatch[2].trim();
        const qty = parseInt(tableMatch[3], 10);
        const price = parseFloat(tableMatch[4]);
        const total = tableMatch[5] ? parseFloat(tableMatch[5]) : qty * price;

        if (qty > 0 && qty < 1000 && name.length >= 2 && !/total|amount|subtotal|tax|balance|signature|date|particulars/i.test(name)) {
          const cleanName = ProductNormalizer.stripNoiseWords(name) || name;
          parsedItem = {
            description: cleanName,
            productCode: null,
            hsn: null,
            quantity: qty,
            unit: 'PCS',
            unitPrice: price,
            discount: 0,
            taxableAmount: total,
            taxRate: 0,
            taxAmount: 0,
            total: total,
            confidence: 85,
          };
          if (price > 0) hasPrice = true;
        }
      }
    }

    // PATTERN C: Explicit Qty or Price Keywords (e.g. "Samsung A15 Display Qty: 5 Rate: 450", "Vivo Y20 10 Pcs @ 350")
    if (!parsedItem) {
      const keywordMatch = line.match(/^(.+?)\s+(?:qty|quantity|pcs|pc|x)\s*[:#-]?\s*(\d+)(?:\s+(?:rate|price|cost|amt|total|@)\s*[:#-]?\s*(\d+(?:\.\d+)?))?/i);
      if (keywordMatch) {
        const name = keywordMatch[1].replace(/^\s*\d+[.\s|-]*/, '').trim();
        const qty = parseInt(keywordMatch[2], 10);
        const price = keywordMatch[3] ? parseFloat(keywordMatch[3]) : 0;
        const total = qty * price;

        if (qty > 0 && qty < 1000 && name.length >= 2 && !/total|amount|subtotal|particulars/i.test(name)) {
          const cleanName = ProductNormalizer.stripNoiseWords(name) || name;
          parsedItem = {
            description: cleanName,
            productCode: null,
            hsn: null,
            quantity: qty,
            unit: 'PCS',
            unitPrice: price,
            discount: 0,
            taxableAmount: total,
            taxRate: 0,
            taxAmount: 0,
            total: total,
            confidence: 80,
          };
          if (price > 0) hasPrice = true;
        }
      }
    }

    // PATTERN D: Stock Slip Line Format (e.g. "1 2 J2", "2 6 J5", "12 3 A14 4G", "5 Vivo Y20", "Redmi Note 10 - 10 Pcs")
    if (!parsedItem) {
      const stockMatch3 = line.match(/^(?:(\d+)[.\s|-]+)?(\d+)\s+([A-Za-z0-9\s/().+-]+)$/);
      if (stockMatch3) {
        const qty = parseInt(stockMatch3[2], 10);
        const name = stockMatch3[3].trim();
        if (qty > 0 && qty < 1000 && name.length >= 1 && !/total|amount|signature|date|particulars|s\.no|grand/i.test(name)) {
          const cleanName = ProductNormalizer.stripNoiseWords(name) || name;
          parsedItem = {
            description: cleanName,
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
          };
        }
      }
    }

    // PATTERN E: Model Name followed by trailing Qty (e.g. "Samsung A15 Folder - 10" or "Battery BLP793 5")
    if (!parsedItem) {
      const endQtyMatch = line.match(/^([A-Za-z0-9\s/().+-]+?)\s*[-:|]\s*(\d+)\s*(?:pcs|pc|nos)?$/i);
      if (endQtyMatch) {
        const name = endQtyMatch[1].replace(/^\s*\d+[.\s|-]*/, '').trim();
        const qty = parseInt(endQtyMatch[2], 10);
        if (qty > 0 && qty < 1000 && name.length >= 2 && !/total|amount|subtotal|particulars|invoice|date/i.test(name)) {
          const cleanName = ProductNormalizer.stripNoiseWords(name) || name;
          parsedItem = {
            description: cleanName,
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
            confidence: 70,
          };
        }
      }
    }

    if (parsedItem) {
      items.push(parsedItem);
    }
  }

  const calculatedSubtotal = items.reduce((sum, i) => sum + i.total, 0);

  return {
    provider: 'Tesseract/PDFTextEngine',
    documentType: hasPrice ? 'PURCHASE_INVOICE' : 'STOCK_SHEET',
    supplier: { name: supplierName, gstin: null, phone: null, address: null },
    customer: { name: customerName, phone: customerPhone },
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    buyer: { name: customerName || 'Ashnoor Singh', gstin: null },
    invoiceNumber: invoiceNumber || `STOCK-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceDate,
    dueDate: null,
    poNumber: null,
    items,
    subtotal: calculatedSubtotal,
    discount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    grandTotal: calculatedSubtotal,
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
}

/**
 * Tesseract Multi-Pass & PDF Engine Adapter (Fallback Engine)
 */
export class TesseractEngineProvider extends DocumentAIProvider {
  async processDocument(filePath, mimeType = 'image/jpeg') {
    if (!filePath || !fs.existsSync(filePath)) return null;

    try {
      const isPdf = mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf');
      let rawText = '';

      if (isPdf) {
        console.log('📄 TesseractEngineProvider: Extracting text from PDF document via pdf-parse...');
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(fileBuffer);
          rawText = pdfData?.text || '';
        } catch (pdfErr) {
          console.warn('PDF parse fallback warning:', pdfErr.message);
        }
      }

      if (!rawText || rawText.trim().length === 0) {
        console.log('🔍 TesseractEngineProvider: Running high-contrast multi-pass Tesseract OCR...');
        const processedPath = await ImageProcessor.preprocessForTesseract(filePath);

        try {
          // Pass 1: PSM 6 (Uniform text block / table)
          const res6 = await Promise.race([
            recognizeOCR(processedPath, 'eng', { tessedit_pageseg_mode: '6' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Tesseract Timeout')), 12000))
          ]);
          rawText = res6?.data?.text || '';

          // Pass 2: PSM 3 (Auto Page Layout) if text is sparse
          if ((!rawText || rawText.trim().length < 40) && processedPath) {
            const res3 = await Promise.race([
              recognizeOCR(processedPath, 'eng', { tessedit_pageseg_mode: '3' }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Tesseract Timeout')), 12000))
            ]);
            if (res3?.data?.text) {
              rawText += '\n' + res3.data.text;
            }
          }
        } catch (tessErr) {
          console.warn('Tesseract OCR pass notice:', tessErr.message);
        }

        if (processedPath !== filePath && fs.existsSync(processedPath)) {
          try { fs.unlinkSync(processedPath); } catch (e) {}
        }
      }

      console.log(`--- OCR / PDF EXTRACTED ${rawText.length} CHARS ---`);

      return parseExtractedText(rawText);
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

    // Try Primary specialized Gemini Document AI adapter first if API key exists
    if (apiKey && isValidGeminiApiKey(apiKey)) {
      try {
        const geminiAdapter = new GoogleGeminiDocumentAIProvider(apiKey);
        const geminiResult = await geminiAdapter.processDocument(filePath, mimeType);
        if (geminiResult && geminiResult.items && geminiResult.items.length > 0) {
          return geminiResult;
        }
      } catch (gemErr) {
        console.warn('Gemini vision error:', gemErr.message);
      }
    }

    // Fallback to Fast Tesseract & PDF engine adapter
    const tesseractAdapter = new TesseractEngineProvider();
    const tesseractResult = await tesseractAdapter.processDocument(filePath, mimeType);
    if (tesseractResult && tesseractResult.items && tesseractResult.items.length > 0) {
      return tesseractResult;
    }

    return tesseractResult || {
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
      rawText: 'No text extracted. Please retake photo with better lighting or ensure file is legible.',
    };
  }
}
