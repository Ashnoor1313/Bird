import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma.js';
import { StockEngine } from '../services/StockEngine.js';
import { ProductNormalizer } from '../services/ProductNormalizer.js';

const router = express.Router();

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

/**
 * Clean & Parse Numbers from Excel cells (strips currency symbols, commas, units like 'pcs', '₹', etc.)
 */
function parseCleanNumber(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Intelligent Excel / CSV Column Header Guesser
 */
function autoDetectColumns(headers) {
  const detect = (patterns) => {
    return headers.find(h => {
      const clean = String(h).trim().toLowerCase();
      return patterns.some(p => clean === p || clean.includes(p));
    }) || '';
  };

  return {
    productName: detect([
      'product name', 'product_name', 'product', 'item name', 'item_name', 'item',
      'description', 'particulars', 'part name', 'part', 'model', 'title', 'name', 'spare part'
    ]),
    quantity: detect([
      'qty', 'quantity', 'pieces', 'pcs', 'stock', 'units', 'count', 'total pcs', 'balance', 'opening', 'available'
    ]),
    purchaseRate: detect([
      'purchase rate', 'purchase_rate', 'buy rate', 'purchase price', 'purchase_price',
      'cost price', 'cost', 'buy price', 'rate', 'unit rate', 'unit price', 'd/p', 'dp', 'price'
    ]),
    sellingPrice: detect([
      'selling price', 'selling_price', 'sale price', 'sale rate', 'retail price', 'retail', 'mrp', 'customer price'
    ]),
    category: detect([
      'category', 'category name', 'type', 'product type', 'group', 'section', 'head'
    ]),
    supplier: detect([
      'supplier', 'supplier name', 'vendor', 'seller', 'party', 'distributor'
    ]),
    brand: detect([
      'brand', 'make', 'company', 'manufacturer', 'oem'
    ]),
    model: detect([
      'model', 'model name', 'phone model', 'compatibility', 'handset'
    ]),
    sku: detect([
      'sku', 'code', 'item code', 'item_code', 'part no', 'part_no', 'barcode', 'hsn'
    ]),
  };
}

/**
 * Universal Spreadsheet Data Parser
 * Standardizes header row search, trims column keys, and maps row values.
 */
function parseSheetData(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return { headers: [], allHeaders: [], rows: [], headerRowIndex: 0 };
  }

  // Find the best header row in the first 15 rows
  let bestHeaderRowIndex = 0;
  let maxScore = -1;
  let bestHeaders = [];

  const knownKeywords = [
    'product', 'item', 'name', 'desc', 'model', 'brand', 'qty', 'quantity',
    'pcs', 'rate', 'price', 'mrp', 'cost', 'category', 'sku', 'code', 'stock', 'part'
  ];

  const searchLimit = Math.min(rawRows.length, 15);
  for (let r = 0; r < searchLimit; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const candidateHeaders = row.map(cell => String(cell || '').trim()).filter(Boolean);
    if (candidateHeaders.length < 2) continue;

    let score = 0;
    candidateHeaders.forEach(h => {
      const lower = h.toLowerCase();
      if (knownKeywords.some(k => lower.includes(k))) score += 2;
      else score += 1;
    });

    if (score > maxScore) {
      maxScore = score;
      bestHeaderRowIndex = r;
      bestHeaders = row.map(cell => String(cell || '').trim());
    }
  }

  // Fallback to row 0 if no candidate met threshold
  if (bestHeaders.length === 0 && rawRows[0]) {
    bestHeaders = rawRows[0].map(cell => String(cell || '').trim());
  }

  const cleanHeaders = bestHeaders.map((h, i) => h || `Col_${i + 1}`);

  // Build row objects starting immediately after bestHeaderRowIndex
  const rows = [];
  for (let r = bestHeaderRowIndex + 1; r < rawRows.length; r++) {
    const rowArr = rawRows[r];
    if (!Array.isArray(rowArr) || rowArr.every(c => String(c || '').trim() === '')) continue;

    const rowObj = { _rowIndex: r + 1 };
    cleanHeaders.forEach((h, hIdx) => {
      rowObj[h] = rowArr[hIdx] !== undefined ? String(rowArr[hIdx]).trim() : '';
    });
    rows.push(rowObj);
  }

  return {
    headers: cleanHeaders.filter(h => !h.startsWith('Col_') || h === cleanHeaders[0]),
    allHeaders: cleanHeaders,
    rows,
    headerRowIndex: bestHeaderRowIndex,
  };
}

// 1. PREVIEW UPLOADED SPREADSHEET WITH COLUMN DETECTION & VALIDATION
router.post('/preview', upload.single('importFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an Excel (.xlsx, .xls) or CSV file from your device.' });
    }

    const filePath = req.file.path;
    const { headers, rows } = parseSheetData(filePath);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty or does not contain data rows.' });
    }

    const detectedMapping = autoDetectColumns(headers);

    let totalDetectedPieces = 0;
    const invalidRows = [];

    const qtyKey = detectedMapping.quantity;
    const nameKey = detectedMapping.productName;

    rows.forEach(rowObj => {
      const rawName = nameKey ? rowObj[nameKey] : '';
      const rawQty = qtyKey ? parseCleanNumber(rowObj[qtyKey], 0) : 0;

      const rowErrors = [];
      if (!rawName) rowErrors.push('Product name missing');
      if (qtyKey && rawQty < 0) rowErrors.push('Invalid quantity');

      if (rowErrors.length > 0) {
        invalidRows.push({
          rowIndex: rowObj._rowIndex,
          rowObj,
          errors: rowErrors,
        });
      } else {
        totalDetectedPieces += Math.max(0, rawQty);
      }
    });

    res.json({
      filePath,
      fileName: req.file.originalname,
      headers,
      detectedMapping,
      totalRows: rows.length,
      totalDetectedPieces,
      invalidCount: invalidRows.length,
      invalidRows: invalidRows.slice(0, 10),
      previewRows: rows.slice(0, 15),
    });
  } catch (err) {
    console.error('File import preview error:', err);
    res.status(500).json({ error: 'Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv document.' });
  }
});

// 2. CONFIRM IMPORT WITH DUPLICATE PREVENTION & RECONCILIATION
router.post('/confirm', async (req, res) => {
  try {
    const { businessId, locationId, filePath, mapping, overrideRows } = req.body;

    if (!businessId || !filePath || !mapping) {
      return res.status(400).json({ error: 'businessId, filePath, and mapping are required' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Uploaded file has expired or was removed. Please re-upload.' });
    }

    // Resolve Location ID (Central Godown or first store location)
    let targetLocId = locationId;
    if (!targetLocId || targetLocId === 'ALL') {
      const godown = await prisma.location.findFirst({ where: { businessId, type: 'GODOWN' } })
        || await prisma.location.findFirst({ where: { businessId, type: 'STORE' } })
        || await prisma.location.findFirst({ where: { businessId } });
      if (godown) targetLocId = godown.id;
    }

    const { rows: parsedRows } = parseSheetData(filePath);
    let data = parsedRows;

    // Apply any inline row overrides provided by client
    if (overrideRows && Array.isArray(overrideRows) && overrideRows.length > 0) {
      const overrideMap = new Map();
      overrideRows.forEach(r => overrideMap.set(r._rowIndex, r));
      data = data.map(d => overrideMap.get(d._rowIndex) || d);
    }

    // Fetch existing products and categories for this business
    const existingProducts = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: { category: true, locationStocks: true },
    });

    const existingCategories = await prisma.category.findMany({
      where: { businessId },
    });

    let matchedExistingCount = 0;
    let createdNewCount = 0;
    let totalPiecesAdded = 0;

    for (const row of data) {
      // 1. Flexible Product Name Resolution
      let rawName = '';
      if (mapping.productName && row[mapping.productName]) {
        rawName = row[mapping.productName];
      } else if (mapping.productName) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === mapping.productName.trim().toLowerCase());
        if (foundKey) rawName = row[foundKey];
      }

      if (!rawName) {
        // Fallback: look for common name keys in the row
        const autoKey = Object.keys(row).find(k => ['product', 'item', 'description', 'name', 'model'].some(sub => k.toLowerCase().includes(sub)));
        if (autoKey) rawName = row[autoKey];
      }

      if (!rawName || !String(rawName).trim()) continue;

      const cleanedName = ProductNormalizer.stripNoiseWords(rawName) || String(rawName).trim();

      // 2. Flexible Quantity Resolution
      let rawQtyVal = mapping.quantity ? row[mapping.quantity] : '';
      if (rawQtyVal === '' && mapping.quantity) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === mapping.quantity.trim().toLowerCase());
        if (foundKey) rawQtyVal = row[foundKey];
      }
      const qty = Math.max(0, Math.round(parseCleanNumber(rawQtyVal, 1)));

      // 3. Flexible Rates
      let rawRateVal = mapping.purchaseRate ? row[mapping.purchaseRate] : '';
      if (rawRateVal === '' && mapping.purchaseRate) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === mapping.purchaseRate.trim().toLowerCase());
        if (foundKey) rawRateVal = row[foundKey];
      }
      const purchaseRate = parseCleanNumber(rawRateVal, 0);

      let rawSellingVal = mapping.sellingPrice ? row[mapping.sellingPrice] : '';
      if (rawSellingVal === '' && mapping.sellingPrice) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === mapping.sellingPrice.trim().toLowerCase());
        if (foundKey) rawSellingVal = row[foundKey];
      }
      const sellingPrice = parseCleanNumber(rawSellingVal, purchaseRate > 0 ? Math.round(purchaseRate * 1.3) : 0);

      const brand = mapping.brand && row[mapping.brand] ? String(row[mapping.brand]).trim() : null;
      const model = mapping.model && row[mapping.model] ? String(row[mapping.model]).trim() : null;
      const sku = mapping.sku && row[mapping.sku] ? String(row[mapping.sku]).trim() : null;

      // 4. Category Resolution (Supports column name or direct category value)
      let categoryName = '';
      if (mapping.category) {
        if (row[mapping.category]) {
          categoryName = String(row[mapping.category]).trim();
        } else if (!Object.keys(row).includes(mapping.category)) {
          categoryName = String(mapping.category).trim();
        }
      }

      let categoryId = null;
      if (categoryName) {
        let cat = existingCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!cat) {
          cat = await prisma.category.create({
            data: { businessId, name: categoryName },
          });
          existingCategories.push(cat);
        }
        categoryId = cat.id;
      }

      // 5. Determine Part Type from Category or Name
      let partType = 'Display';
      const catLower = categoryName.toLowerCase();
      const nameLower = cleanedName.toLowerCase();
      if (catLower.includes('battery') || nameLower.includes('battery')) {
        partType = 'Battery';
      } else if (catLower.includes('touch') || catLower.includes('glass') || nameLower.includes('touch') || nameLower.includes('glass')) {
        partType = 'Touch Glass';
      } else if (catLower.includes('camera') || nameLower.includes('camera')) {
        partType = 'Camera';
      } else if (catLower.includes('housing') || catLower.includes('body') || nameLower.includes('housing')) {
        partType = 'Body';
      } else if (catLower.includes('pcb') || catLower.includes('charging') || nameLower.includes('charging')) {
        partType = 'Charging PCB';
      }

      // 6. Duplicate Prevention via Product Normalizer
      const matchResult = await ProductNormalizer.matchProduct(cleanedName, businessId, existingProducts);
      let targetProduct = matchResult.match;

      if (targetProduct) {
        // MATCH FOUND: Increment stock on existing product
        if (qty > 0) {
          await StockEngine.recordMovement({
            businessId,
            productId: targetProduct.id,
            locationId: targetLocId,
            type: 'PURCHASE',
            quantity: qty,
            stockState: 'GOOD',
            reference: 'EXCEL_IMPORT',
            note: `Stock imported via Excel (${cleanedName})`,
          });
        }

        // Update purchase/selling price if new non-zero rates are supplied
        if (purchaseRate > 0) {
          await prisma.product.update({
            where: { id: targetProduct.id },
            data: {
              purchasePrice: purchaseRate,
              sellingPrice: sellingPrice > 0 ? sellingPrice : targetProduct.sellingPrice,
            },
          });
        }

        matchedExistingCount++;
        totalPiecesAdded += qty;
      } else {
        // NO MATCH FOUND: Create new product record
        const entities = ProductNormalizer.extractEntities(cleanedName);

        const newProd = await prisma.product.create({
          data: {
            businessId,
            categoryId: categoryId || null,
            name: cleanedName,
            brand: brand || entities.detectedBrand || null,
            model: model || null,
            partType: partType || entities.detectedPartType || 'Display',
            quality: entities.detectedQuality || 'OEM',
            unit: 'PCS',
            itemCode: `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
            sku: sku,
            purchasePrice: purchaseRate,
            sellingPrice: sellingPrice,
            currentStock: 0,
            goodStock: 0,
            minStock: 5,
          },
        });

        existingProducts.push(newProd);

        if (qty > 0) {
          await StockEngine.recordMovement({
            businessId,
            productId: newProd.id,
            locationId: targetLocId,
            type: 'OPENING',
            quantity: qty,
            stockState: 'GOOD',
            reference: 'EXCEL_IMPORT',
            note: 'Initial import opening stock',
          });
        }

        createdNewCount++;
        totalPiecesAdded += qty;
      }
    }

    // Clean up temporary upload file safely
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }

    res.json({
      message: `Import complete: ${totalPiecesAdded} pieces processed (${matchedExistingCount} existing products updated, ${createdNewCount} new products created).`,
      matchedExistingCount,
      createdNewCount,
      totalPiecesAdded,
    });
  } catch (err) {
    console.error('Import confirm error:', err);
    res.status(500).json({ error: err.message || 'Failed to process Excel import' });
  }
});

export default router;
