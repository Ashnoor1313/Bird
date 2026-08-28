import tesseractPkg from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import { ProductNormalizer } from './ProductNormalizer.js';
import { ImageProcessor } from './ImageProcessor.js';
import { parseExtractedText, recognizeOCR, isValidGeminiApiKey } from './DocumentAIProvider.js';

export class OcrEngine {
  /**
   * Parse an uploaded invoice image, document, or handwritten stock sheet
   * @param {string} filePath
   */
  static async scanBill(filePath) {
    try {
      console.log(`📷 Processing document OCR scan: ${filePath}`);

      // 1. TRY GEMINI MULTIMODAL VISION LLM IF VALID API KEY IS AVAILABLE
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      if (apiKey && isValidGeminiApiKey(apiKey) && filePath && fs.existsSync(filePath)) {
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

      // 2. TEXT PDF OR MULTI-PASS IMAGE OCR
      let rawText = '';
      const isPdf = filePath.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        try {
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          rawText = pdfData?.text || '';
        } catch (pdfErr) {
          console.warn('PDF parsing error in OcrEngine:', pdfErr.message);
        }
      }

      if ((!rawText || rawText.trim().length === 0) && filePath && fs.existsSync(filePath)) {
        const processedPath = await ImageProcessor.preprocessForTesseract(filePath);

        try {
          // Pass 1: PSM 6 (Uniform Block)
          const resultPsm6 = await Promise.race([
            recognizeOCR(processedPath, 'eng', { tessedit_pageseg_mode: '6' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OCR Timeout')), 15000))
          ]);
          rawText = resultPsm6?.data?.text || '';

          // Pass 2: PSM 3 (Auto Layout) if rawText is sparse
          if ((!rawText || rawText.length < 40) && processedPath) {
            const resultPsm3 = await Promise.race([
              recognizeOCR(processedPath, 'eng', { tessedit_pageseg_mode: '3' }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('OCR Timeout')), 15000))
            ]);
            if (resultPsm3?.data?.text) {
              rawText += '\n' + resultPsm3.data.text;
            }
          }

          if (processedPath !== filePath && fs.existsSync(processedPath)) {
            try { fs.unlinkSync(processedPath); } catch (e) {}
          }
        } catch (procErr) {
          console.warn('Sharp preprocessing / Tesseract warning:', procErr.message);
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
    if (!isValidGeminiApiKey(apiKey)) return null;

    const ai = new GoogleGenAI({ apiKey });
    const isPdf = filePath.toLowerCase().endsWith('.pdf');

    let base64Image = '';
    let targetMimeType = 'image/jpeg';

    if (isPdf) {
      base64Image = fs.readFileSync(filePath).toString('base64');
      targetMimeType = 'application/pdf';
    } else {
      const prep = await ImageProcessor.preprocessForVisionAI(filePath);
      base64Image = (prep?.buffer || fs.readFileSync(filePath)).toString('base64');
      targetMimeType = prep?.mimeType || 'image/jpeg';
    }

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

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let response = null;

    for (const mName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: mName,
          contents: [
            {
              inlineData: {
                mimeType: targetMimeType,
                data: base64Image,
              },
            },
            prompt,
          ],
        });
        if (response && response.text) break;
      } catch (e) {
        console.warn(`OcrEngine Gemini model ${mName} call failed:`, e.message);
      }
    }

    if (!response || !response.text) return null;

    const text = response.text;
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
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
          supplierName: parsed.supplierName || 'Wholesale Supplier',
          customerName: parsed.customerName || 'Customer',
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
    const result = parseExtractedText(rawText);
    return {
      docType: result.documentType,
      supplierName: result.supplier?.name || (result.documentType === 'STOCK_SHEET' ? 'Handwritten Stock Sheet' : 'Wholesale Mobile Supplier'),
      customerName: result.customerName || result.customer?.name || 'Customer',
      customerPhone: result.customerPhone || null,
      billNo: result.invoiceNumber,
      date: result.invoiceDate,
      items: result.items.map(i => ({
        productName: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        gstPercentage: i.taxRate || 0,
        total: i.total,
        hasPrice: i.unitPrice > 0,
      })),
      subtotal: result.subtotal,
      gst: 0,
      total: result.grandTotal,
      verified: result.items.length > 0,
      rawText,
    };
  }
}
