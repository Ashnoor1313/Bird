import tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { ProductNormalizer } from './ProductNormalizer.js';

export class OcrEngine {
  /**
   * Parse an uploaded invoice image, document, or handwritten stock sheet
   * @param {string} filePath
   */
  static async scanBill(filePath) {
    try {
      console.log(`📷 Processing document OCR scan: ${filePath}`);

      // 1. TRY GEMINI MULTIMODAL VISION LLM IF API KEY IS AVAILABLE
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      if (apiKey && filePath && fs.existsSync(filePath)) {
        try {
          console.log('🤖 Invoking Gemini Multimodal Vision AI for handwritten document extraction...');
          const aiResult = await this.scanWithGeminiVision(filePath, apiKey);
          if (aiResult && aiResult.items && aiResult.items.length > 0) {
            console.log(`✨ Gemini Vision successfully extracted ${aiResult.items.length} items from document!`);
            return aiResult;
          }
        } catch (aiErr) {
          console.warn('Gemini Vision OCR attempt warning:', aiErr.message);
        }
      }

      // 2. MULTI-PASS PREPROCESSING (SHARP + TESSERACT LINE-BY-LINE CLUSTERING)
      let rawText = '';
      if (filePath && fs.existsSync(filePath)) {
        const processedPath = `${filePath}_proc.png`;
        try {
          await sharp(filePath)
            .resize({ width: 2400, fit: 'inside', withoutEnlargement: false })
            .grayscale()
            .linear(1.6, -0.25) // High contrast ink binarization
            .sharpen({ sigma: 1.8 })
            .toFile(processedPath);

          // Pass 1: PSM 6 (Uniform Block)
          const resultPsm6 = await Promise.race([
            tesseract.recognize(processedPath, 'eng', { tessedit_pageseg_mode: '6' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OCR Timeout')), 15000))
          ]);
          rawText = resultPsm6?.data?.text || '';

          // Pass 2: PSM 11 (Sparse Text / Handwriting) if rawText is sparse
          if ((!rawText || rawText.length < 50) && fs.existsSync(processedPath)) {
            const resultPsm11 = await Promise.race([
              tesseract.recognize(processedPath, 'eng', { tessedit_pageseg_mode: '11' }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('OCR Timeout')), 15000))
            ]);
            if (resultPsm11?.data?.text) {
              rawText += '\n' + resultPsm11.data.text;
            }
          }

          if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
        } catch (procErr) {
          console.warn('Sharp preprocessing / Tesseract warning:', procErr.message);
          try {
            const rawResult = await tesseract.recognize(filePath, 'eng');
            rawText = rawResult?.data?.text || '';
          } catch (e) {
            console.error('Raw Tesseract fallback failed:', e.message);
          }
        }
      }

      console.log('--- OCR RAW EXTRACTED TEXT ---');
      console.log(rawText);
      console.log('------------------------------');

      return this.parseDocumentText(rawText);
    } catch (err) {
      console.error('Error during OCR processing:', err);
      return this.parseDocumentText('');
    }
  }

  /**
   * Alias for scanBill
   */
  static async processBillImage(filePath) {
    return this.scanBill(filePath);
  }

  /**
   * Gemini Multimodal Vision OCR extraction
   */
  static async scanWithGeminiVision(filePath, apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const imageBytes = fs.readFileSync(filePath);
    const base64Image = imageBytes.toString('base64');

    const prompt = `You are an expert OCR document scanner for mobile spare-parts shop invoices and handwritten stock sheets (like Vyapar / MyBillBook OCR).
Examine this document / handwritten bill photo carefully.
Extract EVERY single handwritten or printed item line listed in the photo.

CRITICAL CLEANING RULES:
1. Ignore and strip noise/category words such as: 'incell', 'in-cell', 'wd', 'w/d', 'bid', 'big', 'cc', 'c.c', 'sub board', 'bord', 'board', 'oem', 'og', 'copy', 'orig', 'original', 'aaa', 'diamond', 'crown', 'with frame', 'without frame', 'wf', 'wof', 'combo', 'pcs', 'qty'.
2. Return ONLY the clean phone brand & model name for productName (e.g. "Samsung A15", "Redmi Note 10", "Vivo Y21", "J7 Prime", "iPhone 11", "Oppo A53").
3. Quantities must be numbers. Default unitPrice to 0 if not present.

Return ONLY valid JSON:
{
  "docType": "STOCK_SHEET" or "PURCHASE_BILL",
  "supplierName": string or null,
  "customerName": string or null,
  "billNo": string or null,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "productName": "string (cleaned model name without incell, wd, bid, cc, bord, oem)",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ]
}`;

    const response = await ai.models.generateContent({
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

    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        let subtotal = 0;
        let hasAnyPrice = false;
        parsed.items.forEach(i => {
          i.productName = ProductNormalizer.stripNoiseWords(i.productName) || i.productName;
          i.quantity = parseInt(i.quantity, 10) || 1;
          i.unitPrice = parseFloat(i.unitPrice) || 0;
          i.total = i.quantity * i.unitPrice;
          subtotal += i.total;
          if (i.unitPrice > 0) hasAnyPrice = true;
        });

        return {
          docType: parsed.docType || (hasAnyPrice ? 'PURCHASE_BILL' : 'STOCK_SHEET'),
          supplierName: parsed.supplierName || 'Handwritten Stock Sheet',
          customerName: parsed.customerName || 'Ashnoor Singh',
          billNo: parsed.billNo || `STOCK-${Math.floor(1000 + Math.random() * 9000)}`,
          date: parsed.date || new Date().toISOString().split('T')[0],
          items: parsed.items,
          subtotal,
          gst: 0,
          total: subtotal,
          verified: true,
          rawText: text,
        };
      }
    }
    return null;
  }

  /**
   * Intelligently classify document type and extract structured items dynamically from raw text
   */
  static parseDocumentText(rawText) {
    const lines = (rawText || '').split('\n').map(l => l.trim()).filter(Boolean);

    let supplierName = '';
    let customerName = '';
    let billNo = '';
    let date = new Date().toISOString().split('T')[0];
    const items = [];
    let hasAnyPrice = false;

    for (const line of lines) {
      // Skip table headers and structural noise
      if (/particulars|s\.no|rate|amount|qty|quantity|balance|description|signature|e\.&o\.e/i.test(line) && line.length < 40) {
        continue;
      }

      // Detect Supplier
      if (/supplier|vendor|from|wholesale|traders|mobiles/i.test(line) && !supplierName) {
        supplierName = line.replace(/(supplier|vendor|from):/i, '').trim();
      }

      // Detect Customer Name
      if (/(?:customer|client|to|m\/s|name|buyer)\s*[:#-]?\s*([A-Za-z0-9\s.]+)/i.test(line) && !customerName) {
        const match = line.match(/(?:customer|client|to|m\/s|name|buyer)\s*[:#-]?\s*([A-Za-z0-9\s.]+)/i);
        if (match && match[1] && match[1].trim().length > 2) {
          customerName = match[1].trim();
        }
      }

      // 1. Math Validation Strategy (Qty * Rate = Total)
      const numbers = [];
      const numRegex = /\b\d+(?:\.\d+)?\b/g;
      let m;
      while ((m = numRegex.exec(line)) !== null) {
        numbers.push({ val: parseFloat(m[0]), raw: m[0], index: m.index });
      }

      if (numbers.length >= 2) {
        let matchedMath = false;
        for (let i = 0; i < numbers.length; i++) {
          for (let j = 0; j < numbers.length; j++) {
            if (i === j) continue;
            for (let k = 0; k < numbers.length; k++) {
              if (k === i || k === j) continue;
              const qty = numbers[i].val;
              const rate = numbers[j].val;
              const amt = numbers[k].val;

              if (qty > 0 && qty <= 1000 && rate > 50 && Math.abs(qty * rate - amt) < 10) {
                let text = line;
                [numbers[i], numbers[j], numbers[k]].forEach(n => {
                  text = text.replace(n.raw, '');
                });
                text = text.replace(/^\s*\d+[.\s|-]*/, '').replace(/[^a-zA-Z0-9\s/().-]/g, ' ').trim();
                const cleanedName = ProductNormalizer.stripNoiseWords(text) || text || 'Spare Part Item';

                items.push({
                  productName: cleanedName,
                  quantity: qty,
                  unitPrice: rate,
                  gstPercentage: 0,
                  total: Math.round(qty * rate),
                  hasPrice: true,
                });
                hasAnyPrice = true;
                matchedMath = true;
                break;
              }
            }
            if (matchedMath) break;
          }
          if (matchedMath) break;
        }
        if (matchedMath) continue;
      }

      // 2. Handwritten Stock Sheet Line Pattern (e.g. "1 2 J2", "2 6 J5", "3 6 J7", "4 4 J7 Prime", "5 1 A70", "6 1 A10S", "7 1 A51", "8 1 A11", "9 3 A31", "10 1 M11")
      const stockMatch = line.match(/^(?:\d+[.\s|-]+)?(\d+)\s+([A-Za-z0-9\s/().+-]+)$/);
      if (stockMatch) {
        const qty = parseInt(stockMatch[1], 10);
        const name = stockMatch[2].trim();
        if (qty > 0 && qty < 1000 && name.length >= 1 && !/total|amount|signature|date|particulars/i.test(name)) {
          const cleanedName = ProductNormalizer.stripNoiseWords(name) || name;
          items.push({
            productName: cleanedName,
            quantity: qty,
            unitPrice: 0,
            gstPercentage: 0,
            total: 0,
            hasPrice: false,
          });
          continue;
        }
      }
    }

    const docType = hasAnyPrice ? 'PURCHASE_BILL' : 'STOCK_SHEET';
    let subtotal = 0;
    items.forEach(i => subtotal += i.quantity * (i.unitPrice || 0));

    return {
      docType,
      supplierName: supplierName || (docType === 'STOCK_SHEET' ? 'Handwritten Stock Sheet' : 'Wholesale Mobile Supplier'),
      customerName: customerName || 'Ashnoor Singh',
      billNo: billNo || `STOCK-${Math.floor(1000 + Math.random() * 9000)}`,
      date,
      items,
      subtotal,
      gst: 0,
      total: subtotal,
      verified: items.length > 0,
      rawText,
    };
  }
}
