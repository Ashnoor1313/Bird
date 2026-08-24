import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="20" y="40" font-family="Arial" font-size="24" font-weight="bold" fill="black">Gupta Mobile Spare - Karol Bagh</text>
    <text x="20" y="80" font-family="Arial" font-size="18" fill="black">Date: 22-08-2026   Bill No: 4920</text>
    <text x="20" y="120" font-family="Arial" font-size="18" fill="black">Customer: Sharma Mobile (9876543210)</text>
    <text x="20" y="170" font-family="Arial" font-size="16" fill="black">1. 8.1.9i - 10 pcs @ 590 = 5900</text>
    <text x="20" y="200" font-family="Arial" font-size="16" fill="black">2. 12c - 5 pcs @ 530 = 2650</text>
    <text x="20" y="230" font-family="Arial" font-size="16" fill="black">3. C11 - 10 pcs @ 485 = 4850</text>
    <text x="20" y="260" font-family="Arial" font-size="16" fill="black">4. Nf 11g - 5 pcs @ 600 = 3000</text>
    <text x="20" y="290" font-family="Arial" font-size="16" fill="black">5. Nf 8p0 - 5 pcs @ 530 = 2650</text>
    <text x="20" y="320" font-family="Arial" font-size="16" fill="black">6. A14 Sgwd - 2 pcs @ 550 = 1100</text>
    <text x="20" y="350" font-family="Arial" font-size="16" fill="black">7. C3 - 10 pcs @ 485 = 4850</text>
    <text x="20" y="385" font-family="Arial" font-size="20" font-weight="bold" fill="black">Total: 25000</text>
  </svg>`;

  // Preprocess: rotate, resize, optimize jpeg
  const optimizedBuffer = await sharp(Buffer.from(svg))
    .rotate()
    .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64 = optimizedBuffer.toString('base64');
  console.log(`Optimized image size: ${(optimizedBuffer.length / 1024).toFixed(1)} KB`);

  console.log('Sending optimized invoice to Gemini 2.5 Flash...');
  const t0 = Date.now();
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64,
        },
      },
      `You are an expert Indian mobile spare-parts bill OCR parser.
Extract all customer details, invoice number, and line items.
Return ONLY a JSON object:
{
  "customerName": string or null,
  "customerPhone": string or null,
  "invoiceNumber": string or null,
  "invoiceDate": string or null,
  "items": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "grandTotal": number
}`,
    ],
  });
  console.log(`⏱️ Time taken: ${Date.now() - t0}ms`);
  console.log('Response:', resp.text);
}

test().catch(console.error);
