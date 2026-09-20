import express from 'express';
import multer from 'multer';
import path from 'path';
import prisma from '../prisma.js';
import PDFDocument from 'pdfkit';
import { StockEngine } from '../services/StockEngine.js';
import { LedgerEngine } from '../services/LedgerEngine.js';
import { DocumentAIOrchestrator } from '../services/DocumentAIProvider.js';
import { ProductMatcher } from '../services/ProductMatcher.js';
import { ProductNormalizer } from '../services/ProductNormalizer.js';
import { OcrJobService } from '../services/OcrJobService.js';
import { CacheService } from '../services/CacheService.js';

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

// Multer storage for sale bill scans
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getUploadDir()),
  filename: (req, file, cb) => cb(null, `sale_bill_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// Get list of sales bills with store and category isolation
router.get('/', async (req, res) => {
  try {
    const { businessId, locationId, categoryId, search } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const cacheKey = `sales:${businessId}:${locationId || 'ALL'}:${categoryId || 'ALL'}:${search || ''}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let where = { businessId };
    if (locationId && locationId !== 'ALL') {
      where.locationId = locationId;
    }
    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }
    if (search) {
      const q = search.trim();
      where.OR = [
        { billNo: { contains: q } },
        { customerName: { contains: q } },
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        location: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    CacheService.set(cacheKey, sales, 60000); // 60s cache
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// ASYNC SCAN JOB CREATION FOR SALES (Instant return for mobile devices)
router.post('/scan-job', upload.single('billFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bill file/image is required' });
    }
    const job = OcrJobService.createJob(req.file, { ...req.body, type: 'SALE' });
    res.status(202).json({
      success: true,
      jobId: job.id,
      status: job.status,
      step: job.step,
      percent: job.percent,
      message: job.message,
    });
  } catch (err) {
    console.error('Sales scan job creation error:', err);
    res.status(500).json({ error: 'Failed to create sales scan job' });
  }
});

// SCAN SALE BILL OCR ENDPOINT (Contextual category matching)
router.post('/scan', upload.single('billFile'), async (req, res) => {
  try {
    const { businessId, locationId, categoryId = 'folders', geminiApiKey } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Bill file/image is required' });
    }

    const imagePath = req.file.path;
    const docResult = await DocumentAIOrchestrator.processDocument(imagePath, req.file.mimetype, { geminiApiKey });

    // Extract items
    const rawItems = (docResult.items || []).map(item => {
      const rawText = item.description || item.productName || 'Mobile Spare Part';
      const cleanName = ProductNormalizer.stripNoiseWords(rawText) || rawText;
      return {
        productName: cleanName,
        quantity: parseInt(item.quantity, 10) || 1,
        unitPrice: parseFloat(item.unitPrice || 0),
        discount: parseFloat(item.discount || 0),
        gstPercentage: 0,
        total: parseFloat(item.total || (item.quantity * item.unitPrice)),
      };
    });

    const matchedItems = await ProductMatcher.matchAllItems(rawItems, businessId);

    res.json({
      customerName: docResult.customerName || docResult.customer?.name || docResult.buyer?.name || docResult.supplier?.name || '',
      customerPhone: docResult.customerPhone || docResult.customer?.phone || docResult.buyer?.phone || docResult.supplier?.phone || '',
      invoiceNumber: docResult.invoiceNumber || '',
      invoiceDate: docResult.invoiceDate || new Date().toISOString().split('T')[0],
      items: matchedItems,
      subtotal: docResult.subtotal || 0,
      grandTotal: docResult.grandTotal || 0,
      categoryId,
      imagePath,
    });
  } catch (err) {
    console.error('Sale bill scan error:', err);
    res.status(500).json({ error: 'Failed to scan bill', message: err.message });
  }
});

// Get single Sale detail
router.get('/:id', async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        location: true,
        items: {
          include: { product: true },
        },
        business: true,
      },
    });

    if (!sale) return res.status(404).json({ error: 'Sale bill not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sale details' });
  }
});

// CREATE SALE / MAKE BILL (Atomic with Category & Store Scoping and Real Profit Tracking)
router.post('/', async (req, res) => {
  try {
    const {
      businessId,
      locationId,
      categoryId = 'folders',
      customerId,
      customerName,
      customerPhone,
      items, // [{ productId, productName, quantity, unitPrice, discount, purchasePrice }]
      discount = 0,
      paidAmount = 0,
      paymentMethod = 'CASH',
      notes,
    } = req.body;

    let effectiveLocationId = locationId;
    if (!effectiveLocationId || effectiveLocationId === 'ALL') {
      const defaultStore = await prisma.location.findFirst({
        where: { businessId, type: 'STORE' },
      }) || await prisma.location.findFirst({
        where: { businessId },
      });
      if (defaultStore) effectiveLocationId = defaultStore.id;
    }

    if (!businessId || !effectiveLocationId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'businessId, locationId (store ID), and non-empty items array are required' });
    }

    const resolvedLocationId = effectiveLocationId;
    const resolvedCategory = categoryId === 'batteries' ? 'batteries' : 'folders';
    const location = await prisma.location.findUnique({ where: { id: resolvedLocationId } });
    if (!location) return res.status(400).json({ error: 'Invalid store locationId' });

    // Ensure customer belongs to the SAME business
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(400).json({ error: 'Customer not found' });
      }
      if (customer.businessId !== businessId) {
        return res.status(400).json({ error: 'Customer belongs to a different business' });
      }
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // Prefix with category identifier if desired, or standard business starting bill number
    const catPrefix = resolvedCategory === 'batteries' ? 'BAT' : 'FLD';
    const billNo = `${business.billPrefix || 'BIRD'}-${catPrefix}-${business.startingBillNo}`;

    // Execute within Prisma transaction for strict financial integrity
    const result = await prisma.$transaction(async (tx) => {
      // Calculate totals and COGS
      let subtotal = 0;
      let totalCost = 0;
      const saleItemsData = [];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        const price = parseFloat(item.unitPrice);
        const itemDiscount = parseFloat(item.discount || 0);
        const lineSubtotal = qty * price - itemDiscount;
        const lineTotal = lineSubtotal;

        subtotal += lineSubtotal;

        let resolvedProductName = item.productName;
        let resolvedModel = item.model;
        let purchasePrice = parseFloat(item.purchasePrice || 0);

        if (item.productId) {
          const dbProduct = await tx.product.findUnique({ where: { id: item.productId } });
          if (dbProduct) {
            resolvedProductName = resolvedProductName || dbProduct.name;
            resolvedModel = resolvedModel || dbProduct.model;
            if (dbProduct.purchasePrice && dbProduct.purchasePrice > 0) {
              purchasePrice = dbProduct.purchasePrice;
            }
          }
        }

        const lineCost = qty * purchasePrice;
        totalCost += lineCost;

        saleItemsData.push({
          productId: item.productId || null,
          productName: resolvedProductName || 'Mobile Spare Part Item',
          model: resolvedModel || null,
          quantity: qty,
          unitPrice: price,
          purchasePrice,
          discount: itemDiscount,
          gstPercentage: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: lineTotal,
          warrantyDays: '7 Days Testing',
        });
      }

      const totalBill = subtotal - parseFloat(discount || 0);
      const grossProfit = totalBill - totalCost;

      let paid = 0;
      if (paidAmount !== undefined && paidAmount !== null && paidAmount !== '') {
        paid = parseFloat(paidAmount);
      } else if (req.body.paymentStatus === 'PAID' || req.body.status === 'PAID') {
        paid = totalBill;
      }
      if (isNaN(paid) || paid < 0) paid = 0;
      paid = Math.min(totalBill, paid);
      const due = Math.max(0, totalBill - paid);
      const finalPaymentMethod = paymentMethod || req.body.paymentMode || 'CASH';

      // AUTOMATIC CUSTOMER RESOLUTION & CREATION SCOPED TO LOCATION & CATEGORY
      let resolvedCustomerId = customerId || null;
      let resolvedCustomerName = customerName ? customerName.trim() : 'Walk-in Customer';

      if (!resolvedCustomerId && resolvedCustomerName && resolvedCustomerName.toLowerCase() !== 'walk-in customer') {
        let existingCust = null;
        if (customerPhone && customerPhone.trim()) {
          existingCust = await tx.customer.findFirst({
            where: {
              businessId,
              locationId: resolvedLocationId,
              categoryId: resolvedCategory,
              phone: customerPhone.trim(),
            },
          });
        }

        if (!existingCust && resolvedCustomerName) {
          existingCust = await tx.customer.findFirst({
            where: {
              businessId,
              locationId: resolvedLocationId,
              categoryId: resolvedCategory,
              name: { equals: resolvedCustomerName },
            },
          });
        }

        if (existingCust) {
          resolvedCustomerId = existingCust.id;
          resolvedCustomerName = existingCust.name;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              businessId,
              locationId: resolvedLocationId,
              categoryId: resolvedCategory,
              name: resolvedCustomerName,
              phone: customerPhone ? customerPhone.trim() : null,
              priceLevel: 'RETAIL',
              moneyToReceive: 0,
            },
          });
          resolvedCustomerId = newCustomer.id;
        }
      }

      // Create Sale Record
      const sale = await tx.sale.create({
        data: {
          businessId,
          locationId: resolvedLocationId,
          categoryId: resolvedCategory,
          billNo,
          customerId: resolvedCustomerId,
          customerName: resolvedCustomerName,
          customerPhone: customerPhone || null,
          subtotal,
          discount: parseFloat(discount || 0),
          total: totalBill,
          totalCost,
          grossProfit,
          paidAmount: paid,
          dueAmount: due,
          paymentMethod: finalPaymentMethod,
          notes,
          items: {
            create: saleItemsData,
          },
        },
        include: { items: true },
      });

      // Increment business starting bill number counter
      await tx.business.update({
        where: { id: businessId },
        data: { startingBillNo: business.startingBillNo + 1 },
      });

      // 1. DEDUCT INVENTORY STOCK automatically from specific store location
      for (const item of items) {
        if (item.productId) {
          await StockEngine.recordMovement(
            {
              businessId,
              productId: item.productId,
              locationId: resolvedLocationId,
              categoryId: resolvedCategory,
              type: 'SALE',
              quantity: -parseInt(item.quantity, 10),
              stockState: 'GOOD',
              reference: billNo,
              note: `Sale Bill #${billNo} to ${resolvedCustomerName}`,
            },
            tx
          );
        }
      }

      // 2. UPDATE CUSTOMER KHATA automatically as soon as bill is made!
      if (resolvedCustomerId) {
        // Record total bill on customer ledger
        await LedgerEngine.recordCustomerTransaction(
          {
            businessId,
            locationId: resolvedLocationId,
            customerId: resolvedCustomerId,
            type: 'BILL',
            reference: billNo,
            amount: totalBill,
            note: `Bill ${billNo}`,
          },
          tx
        );

        // Record payment received on bill if paid > 0
        if (paid > 0) {
          await LedgerEngine.recordCustomerTransaction(
            {
              businessId,
              locationId: resolvedLocationId,
              customerId: resolvedCustomerId,
              type: 'PAYMENT',
              reference: `PAY-${billNo}`,
              amount: paid,
              note: `Payment received for bill ${billNo}`,
            },
            tx
          );
        }
      }

      // 3. RECORD PAYMENT IN MONEY ENGINE automatically
      if (paid > 0) {
        await tx.payment.create({
          data: {
            businessId,
            locationId: resolvedLocationId,
            categoryId: resolvedCategory,
            type: 'RECEIVE',
            partyType: 'CUSTOMER',
            customerId: resolvedCustomerId || null,
            partyName: resolvedCustomerName || 'Walk-in Customer',
            amount: paid,
            paymentMethod: finalPaymentMethod,
            reference: billNo,
            notes: `Payment on bill ${billNo}`,
          },
        });

        // Update Cash/Bank balance for this store location
        await LedgerEngine.updateAccountBalance({ businessId, locationId: resolvedLocationId, method: finalPaymentMethod, amount: paid, isIncoming: true }, tx);
      }

      return sale;
    });

    // ⚡ Invalidate related caches immediately so fresh data is visible
    CacheService.invalidate('sales');
    CacheService.invalidate('category-hub');
    CacheService.invalidate('dashboard');
    CacheService.invalidate('pnl');
    CacheService.invalidate('customers');
    CacheService.invalidate('money');
    CacheService.invalidate('products');

    res.status(201).json(result);
  } catch (err) {
    console.error('Make Bill Error:', err);
    res.status(400).json({ error: err.message || 'Failed to create sales bill' });
  }
});

// Download Printable PDF Invoice
router.get('/:id/pdf', async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        business: true,
        items: true,
        customer: true,
        location: true,
      },
    });

    if (!sale) return res.status(404).json({ error: 'Bill not found' });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const cleanBillNo = String(sale.billNo || '1001').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${cleanBillNo}.pdf"`);

    doc.pipe(res);

    const cleanPdfText = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/[^\x00-\x7F]/g, '')
        .trim();
    };

    const business = sale.business || {};
    const businessName = cleanPdfText(business.name) || 'BIRD Mobile Spare Parts';
    const locationName = cleanPdfText(sale.location?.name) || 'Main Store';
    const businessAddress = cleanPdfText(business.address);
    const businessPhone = cleanPdfText(business.phone);
    const businessGstin = cleanPdfText(business.gstin);
    const billNo = cleanPdfText(sale.billNo || sale.invoiceNumber || '1001');

    const customerName = cleanPdfText(sale.customerName) || (sale.customer?.name ? cleanPdfText(sale.customer.name) : 'Walk-in Customer');
    const customerPhone = cleanPdfText(sale.customerPhone) || (sale.customer?.phone ? cleanPdfText(sale.customer.phone) : '');

    const items = sale.items || [];
    const subtotal = Number(sale.subtotal) || items.reduce((acc, i) => acc + (Number(i.quantity || 1) * Number(i.unitPrice || 0)), 0);
    const discount = Number(sale.discount) || 0;
    const total = Number(sale.total) || (subtotal - discount);
    const paidAmount = Number(sale.paidAmount) ?? total;
    const dueAmount = Number(sale.dueAmount) ?? Math.max(0, total - paidAmount);
    const paymentMethod = sale.paymentMethod || 'CASH';

    const dateStr = sale.createdAt || sale.saleDate
      ? new Date(sale.createdAt || sale.saleDate).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const formatCurrency = (val) => {
      return 'Rs. ' + Number(val || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const startX = 40;
    const pageWidth = 515.28;
    const endX = startX + pageWidth; // 555.28
    let curY = 40;

    // 1. STORE / BUSINESS HEADER (MATCHING PREVIEW)
    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(16).text(businessName.toUpperCase(), startX, curY, {
      align: 'center',
      width: pageWidth,
    });
    curY = doc.y + 4;

    const locAddrText = [locationName, businessAddress].filter(Boolean).join(' • ');
    doc.fillColor('#52525b').font('Helvetica-Bold').fontSize(9).text(locAddrText, startX, curY, {
      align: 'center',
      width: pageWidth,
    });
    curY = doc.y + 3;

    if (businessPhone) {
      doc.fillColor('#52525b').font('Helvetica').fontSize(9);
      doc.text(`Phone: ${businessPhone}`, startX, curY, {
        align: 'center',
        width: pageWidth,
      });
      curY = doc.y + 3;
    }

    if (businessGstin) {
      doc.fillColor('#71717a').font('Helvetica').fontSize(8);
      doc.text(`GSTIN: ${businessGstin}`, startX, curY, {
        align: 'center',
        width: pageWidth,
      });
      curY = doc.y + 4;
    }

    // Centered Black Badge: "CASH MEMO / SALES INVOICE"
    const badgeW = 180;
    const badgeH = 18;
    const badgeX = startX + (pageWidth - badgeW) / 2;
    doc.roundedRect(badgeX, curY, badgeW, badgeH, 3).fill('#18181b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('CASH MEMO / SALES INVOICE', badgeX, curY + 4.5, {
      align: 'center',
      width: badgeW,
    });
    curY += badgeH + 10;

    // Thick Header Bottom Divider (2px)
    doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#18181b').lineWidth(2).stroke();
    curY += 12;

    // 2. INVOICE METADATA (BILLED TO & INVOICE NO / DATE - 2 COLUMNS)
    const metaStartY = curY;

    // Left Column: Customer Details
    doc.fillColor('#a1a1aa').font('Helvetica-Bold').fontSize(7.5).text('BILLED TO:', startX, metaStartY);
    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(11).text(customerName, startX, metaStartY + 12, { width: 250 });
    let leftEndY = doc.y;
    if (customerPhone) {
      doc.fillColor('#52525b').font('Helvetica').fontSize(8.5).text(`Ph: ${customerPhone}`, startX, leftEndY + 2, { width: 250 });
      leftEndY = doc.y;
    }

    // Right Column: Invoice # and Date
    doc.fillColor('#a1a1aa').font('Helvetica-Bold').fontSize(7.5).text('INVOICE NO:', 305, metaStartY, { align: 'right', width: 250.28 });
    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(11).text(`#${billNo}`, 305, metaStartY + 10, { align: 'right', width: 250.28 });
    const rightDateY = metaStartY + 25;
    doc.fillColor('#a1a1aa').font('Helvetica-Bold').fontSize(7.5).text('DATE:', 305, rightDateY, { align: 'right', width: 250.28 });
    doc.fillColor('#3f3f46').font('Helvetica').fontSize(8.5).text(dateStr, 305, rightDateY + 10, { align: 'right', width: 250.28 });
    const rightEndY = rightDateY + 22;

    curY = Math.max(leftEndY, rightEndY) + 8;

    // Divider Line Below Metadata
    doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#e4e4e7').lineWidth(1).stroke();
    curY += 12;

    // 3. ITEMS TABLE
    // Columns Layout:
    // #: 40..65 (w:25, center)
    // Item Description: 70..335 (w:265, left)
    // Qty: 340..380 (w:40, center)
    // Rate: 385..460 (w:75, right)
    // Amount: 465..555 (w:90, right)
    doc.fillColor('#27272a').font('Helvetica-Bold').fontSize(8);
    doc.text('#', 40, curY, { width: 25, align: 'center' });
    doc.text('ITEM DESCRIPTION', 70, curY, { width: 265, align: 'left' });
    doc.text('QTY', 340, curY, { width: 40, align: 'center' });
    doc.text('RATE', 385, curY, { width: 75, align: 'right' });
    doc.text('AMOUNT', 465, curY, { width: 90, align: 'right' });
    curY += 14;

    // Thick black line under table header
    doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#18181b').lineWidth(1.5).stroke();
    curY += 8;

    items.forEach((item, idx) => {
      // Automatic page break if running out of space
      if (curY > 720) {
        doc.addPage();
        curY = 40;
      }

      // Index
      doc.fillColor('#71717a').font('Helvetica-Bold').fontSize(8.5).text(String(idx + 1), 40, curY, { width: 25, align: 'center' });

      // Product Description
      const itemDesc = cleanPdfText(item.productName) || 'Product';
      doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(8.5).text(itemDesc, 70, curY, { width: 265, align: 'left' });
      let descEndY = doc.y;

      if (item.model && cleanPdfText(item.model) !== itemDesc) {
        doc.fillColor('#71717a').font('Helvetica').fontSize(7.5).text(`Model: ${cleanPdfText(item.model)}`, 70, descEndY + 1, { width: 265, align: 'left' });
        descEndY = doc.y;
      }

      // Qty
      const qty = item.quantity || 1;
      doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(8.5).text(String(qty), 340, curY, { width: 40, align: 'center' });

      // Rate
      const unitPrice = Number(item.unitPrice) || 0;
      doc.fillColor('#27272a').font('Helvetica').fontSize(8.5).text(formatCurrency(unitPrice), 385, curY, { width: 75, align: 'right' });

      // Amount
      const itemAmount = Number(item.total) || (qty * unitPrice);
      doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(8.5).text(formatCurrency(itemAmount), 465, curY, { width: 90, align: 'right' });

      const rowHeight = Math.max(descEndY, curY + 12) - curY;
      curY += Math.max(rowHeight, 14) + 6;

      // Divider between rows
      doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#e4e4e7').lineWidth(0.5).stroke();
      curY += 7;
    });

    // 4. TOTALS & PAYMENT BREAKDOWN
    if (curY > 670) {
      doc.addPage();
      curY = 40;
    }

    // Top border of totals
    doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#18181b').lineWidth(2).stroke();
    curY += 10;

    // Subtotal
    doc.fillColor('#52525b').font('Helvetica').fontSize(8.5).text('Subtotal:', startX, curY);
    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(8.5).text(formatCurrency(subtotal), 385, curY, { align: 'right', width: 170.28 });
    curY += 14;

    // Discount (if any)
    if (discount > 0) {
      doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8.5).text('Discount:', startX, curY);
      doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8.5).text('-' + formatCurrency(discount), 385, curY, { align: 'right', width: 170.28 });
      curY += 14;
    }

    // Divider before Grand Total
    doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#e4e4e7').lineWidth(0.75).stroke();
    curY += 6;

    // Total Amount
    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(11).text('Total Amount:', startX, curY);
    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(11).text(formatCurrency(total), 385, curY, { align: 'right', width: 170.28 });
    curY += 18;

    // Paid via Payment Method
    doc.fillColor('#047857').font('Helvetica-Bold').fontSize(8.5).text(`Paid via ${paymentMethod}:`, startX, curY);
    doc.fillColor('#047857').font('Helvetica-Bold').fontSize(8.5).text(formatCurrency(paidAmount), 385, curY, { align: 'right', width: 170.28 });
    curY += 16;

    // Payment Status Box
    if (dueAmount > 0) {
      doc.roundedRect(startX, curY, pageWidth, 22, 3).fillAndStroke('#fff1f2', '#fecdd3');
      doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8.5).text('Balance Due (Khata):', startX + 10, curY + 6);
      doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8.5).text(formatCurrency(dueAmount), 380, curY + 6, { align: 'right', width: 165.28 });
      curY += 30;
    } else {
      doc.roundedRect(startX, curY, pageWidth, 20, 3).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc.fillColor('#047857').font('Helvetica-Bold').fontSize(8).text('Payment Status:', startX + 10, curY + 5.5);
      doc.fillColor('#047857').font('Helvetica-Bold').fontSize(8).text('PAID IN FULL', 380, curY + 5.5, { align: 'right', width: 165.28 });
      curY += 28;
    }

    // 5. TERMS & CONDITIONS
    if (curY > 740) {
      doc.addPage();
      curY = 40;
    }

    // Divider before terms
    doc.moveTo(startX, curY).lineTo(endX, curY).strokeColor('#e4e4e7').lineWidth(0.75).stroke();
    curY += 10;

    doc.fillColor('#3f3f46').font('Helvetica-Bold').fontSize(8).text('Terms & Conditions:', startX, curY, { align: 'center', width: pageWidth });
    curY += 12;

    const termsText = cleanPdfText(business.terms);
    if (termsText) {
      doc.fillColor('#71717a').font('Helvetica').fontSize(7.5).text(termsText, startX, curY, { align: 'center', width: pageWidth });
      curY = doc.y + 6;
    } else {
      doc.fillColor('#71717a').font('Helvetica').fontSize(7.5).text('1. 7 Days Testing Warranty on Folders & Batteries (stamp & seal required).', startX, curY, { align: 'center', width: pageWidth });
      curY += 11;
      doc.fillColor('#71717a').font('Helvetica').fontSize(7.5).text('2. Physical damage, flex tear, or display glass break is NOT covered under testing warranty.', startX, curY, { align: 'center', width: pageWidth });
      curY += 14;
    }

    doc.fillColor('#09090b').font('Helvetica-Bold').fontSize(8).text('Thank you for your business!', startX, curY, { align: 'center', width: pageWidth });

    doc.end();
  } catch (err) {
    console.error('PDF Invoice Error:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

export default router;
