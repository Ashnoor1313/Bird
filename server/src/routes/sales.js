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

    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales' });
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
      },
    });

    if (!sale) return res.status(404).json({ error: 'Bill not found' });

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=INVOICE_${sale.billNo}.pdf`);

    doc.pipe(res);

    const cleanPdfText = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/[^\x00-\x7F]/g, '')
        .trim();
    };

    const business = sale.business || {};
    const businessName = cleanPdfText(business.name) || 'Bird Mobile Parts';
    const customerName = cleanPdfText(sale.customerName) || 'Walk-in Customer';
    const primaryColor = '#0284c7';
    const darkColor = '#0f172a';
    const grayColor = '#475569';
    const lightBg = '#f8fafc';
    const borderColor = '#cbd5e1';

    // 1. TOP BRAND ACCENT BAR
    doc.rect(0, 0, 595.28, 6).fill(primaryColor);

    // 2. HEADER SECTION (Left: Logo & Business Info, Right: Invoice Badge Box)
    let curY = 30;

    // Vector Logo Square Badge
    doc.save();
    doc.roundedRect(36, curY, 34, 34, 8).fill(primaryColor);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('B', 36, curY + 9, { width: 34, align: 'center' });
    doc.restore();

    // Business Name & Details
    doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(18).text(businessName, 78, curY);
    doc.fillColor(grayColor).font('Helvetica').fontSize(8.5).text(cleanPdfText(business.address) || '', 78, curY + 22, { width: 280 });
    const subInfoY = doc.y;
    doc.text(`Phone: ${cleanPdfText(business.phone) || 'N/A'}`, 78, subInfoY);

    // Right Side: Invoice Title Badge Box
    doc.roundedRect(375, curY, 184, 62, 6).fill(lightBg).strokeColor(borderColor).lineWidth(1).stroke();
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text('BILL / INVOICE', 380, curY + 8, { align: 'center', width: 174 });
    doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(10).text(`#${sale.billNo}`, 380, curY + 25, { align: 'center', width: 174 });
    doc.fillColor(grayColor).font('Helvetica').fontSize(8.5).text(`Date: ${new Date(sale.saleDate).toLocaleDateString('en-IN')}`, 380, curY + 41, { align: 'center', width: 174 });

    curY = Math.max(doc.y, curY + 70);

    // 3. BILLED TO CARD & PAYMENT STATUS BADGE
    doc.roundedRect(36, curY, 523, 48, 6).fill('#f1f5f9').strokeColor(borderColor).lineWidth(1).stroke();

    doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(7.5).text('BILLED TO (CUSTOMER)', 48, curY + 8);
    doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(10.5).text(customerName, 48, curY + 20);
    if (sale.customerPhone) {
      doc.fillColor(grayColor).font('Helvetica').fontSize(8.5).text(`Phone: ${cleanPdfText(sale.customerPhone)}`, 48, curY + 33);
    }

    // Payment Status Pill
    const isPaid = sale.dueAmount <= 0;
    const statusBg = isPaid ? '#dcfce7' : '#fee2e2';
    const statusText = isPaid ? '#15803d' : '#b91c1c';
    const statusLabel = isPaid ? 'PAID IN FULL' : `BALANCE DUE: Rs. ${sale.dueAmount.toFixed(2)}`;

    doc.roundedRect(410, curY + 13, 136, 22, 11).fill(statusBg);
    doc.fillColor(statusText).font('Helvetica-Bold').fontSize(8).text(statusLabel, 410, curY + 20, { align: 'center', width: 136 });

    curY += 58;

    // 4. ITEMS TABLE
    const tableHeaders = [
      { label: '#', x: 42, width: 20, align: 'left' },
      { label: 'ITEM & SPARE PART DESCRIPTION', x: 65, width: 265, align: 'left' },
      { label: 'QTY', x: 330, width: 40, align: 'right' },
      { label: 'RATE (Rs.)', x: 375, width: 75, align: 'right' },
      { label: 'TOTAL (Rs.)', x: 455, width: 95, align: 'right' },
    ];

    // Header Row Background
    doc.roundedRect(36, curY, 523, 22, 4).fill(primaryColor);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    tableHeaders.forEach(h => {
      doc.text(h.label, h.x, curY + 6, { width: h.width, align: h.align });
    });

    curY += 25;

    // Table Rows
    sale.items.forEach((item, index) => {
      const isEven = index % 2 === 0;
      if (isEven) {
        doc.rect(36, curY - 2, 523, 20).fill('#f8fafc');
      }

      doc.fillColor(darkColor).font('Helvetica').fontSize(8.5);
      doc.text((index + 1).toString(), 42, curY, { width: 20, align: 'left' });

      const itemDesc = cleanPdfText(item.productName);
      doc.font('Helvetica-Bold').text(itemDesc, 65, curY, { width: 265, align: 'left' });

      doc.font('Helvetica').text(item.quantity.toString(), 330, curY, { width: 40, align: 'right' });
      doc.text(item.unitPrice.toFixed(2), 375, curY, { width: 75, align: 'right' });
      doc.font('Helvetica-Bold').text(item.total.toFixed(2), 455, curY, { width: 95, align: 'right' });

      curY += 20;
    });

    doc.moveTo(36, curY).lineTo(559, curY).strokeColor(borderColor).lineWidth(1).stroke();
    curY += 12;

    // 5. SUMMARY BOX & BANK DETAILS SIDE-BY-SIDE
    const summaryStartY = curY;

    // Left Side: Bank Details Card
    if (business.bankName || business.upiId) {
      doc.roundedRect(36, summaryStartY, 255, 95, 6).fill('#f8fafc').strokeColor(borderColor).lineWidth(1).stroke();
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text('PAYMENT DETAILS', 46, summaryStartY + 8);

      let bankY = summaryStartY + 23;
      if (business.bankName) {
        doc.fillColor(grayColor).font('Helvetica').fontSize(8).text(`Bank: ${business.bankName}`, 46, bankY);
        bankY += 13;
      }
      if (business.accountNo) {
        doc.fillColor(grayColor).font('Helvetica').fontSize(8).text(`A/C No: ${business.accountNo}`, 46, bankY);
        bankY += 13;
      }
      if (business.ifscCode) {
        doc.fillColor(grayColor).font('Helvetica').fontSize(8).text(`IFSC Code: ${business.ifscCode}`, 46, bankY);
        bankY += 13;
      }
      if (business.upiId) {
        doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8).text(`UPI ID: ${business.upiId}`, 46, bankY);
      }
    }

    // Right Side: Totals Summary Card
    doc.roundedRect(305, summaryStartY, 254, 100, 6).fill('#f8fafc').strokeColor(borderColor).lineWidth(1).stroke();

    let totY = summaryStartY + 8;
    doc.fillColor(grayColor).font('Helvetica').fontSize(8.5).text('Subtotal:', 315, totY);
    doc.fillColor(darkColor).font('Helvetica-Bold').text(`Rs. ${sale.subtotal.toFixed(2)}`, 445, totY, { align: 'right', width: 104 });
    totY += 14;

    if (sale.discount > 0) {
      doc.fillColor(grayColor).font('Helvetica').fontSize(8.5).text('Discount:', 315, totY);
      doc.fillColor('#dc2626').font('Helvetica-Bold').text(`-Rs. ${sale.discount.toFixed(2)}`, 445, totY, { align: 'right', width: 104 });
      totY += 14;
    }

    // Grand Total Line
    doc.moveTo(315, totY).lineTo(549, totY).strokeColor(borderColor).stroke();
    totY += 5;

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('Grand Total:', 315, totY);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(`Rs. ${sale.total.toFixed(2)}`, 425, totY, { align: 'right', width: 124 });
    totY += 16;

    doc.fillColor('#15803d').font('Helvetica').fontSize(8.5).text('Amount Paid:', 315, totY);
    doc.fillColor('#15803d').font('Helvetica-Bold').text(`Rs. ${sale.paidAmount.toFixed(2)}`, 445, totY, { align: 'right', width: 104 });

    curY = summaryStartY + 115;

    // 6. TERMS & CONDITIONS
    if (business.terms) {
      doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(7.5).text('TERMS:', 36, curY);
      doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(business.terms, 36, curY + 10, { width: 523 });
    }

    // 7. FOOTER
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5).text('Generated by BIRD — Mobile Spare-Parts Business Operating System', 36, 800, { align: 'center', width: 523 });

    doc.end();
  } catch (err) {
    console.error('PDF Invoice Error:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

// SCAN BILL / DOCUMENT AI OCR ENDPOINT FOR SALES BILLS
router.post('/scan', upload.single('billFile'), async (req, res) => {
  let tempFilePath = null;
  try {
    const { businessId, categoryId, geminiApiKey } = req.body;
    let targetBusinessId = businessId;
    if (!targetBusinessId || targetBusinessId === 'undefined' || targetBusinessId === 'null') {
      const firstBiz = await prisma.business.findFirst();
      targetBusinessId = firstBiz?.id;
    }

    if (!targetBusinessId) {
      return res.status(400).json({ error: 'Active business required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Bill file/image is required' });
    }

    tempFilePath = req.file.path;

    // Run Document AI Orchestrator
    const docResult = await DocumentAIOrchestrator.processDocument(tempFilePath, req.file.mimetype, { geminiApiKey });

    if (!docResult || !docResult.items) {
      return res.status(422).json({
        error: 'Unable to extract structured line items from this document',
        rawText: docResult?.rawText || '',
      });
    }

    // Match extracted items against existing Catalog Products
    const catalogProducts = await prisma.product.findMany({
      where: {
        businessId: targetBusinessId,
        ...(categoryId && categoryId !== 'ALL' && categoryId !== 'undefined' ? { categoryId } : {}),
      },
    });

    const reconciledItems = docResult.items.map((rawItem) => {
      const normalizedDescription = ProductNormalizer.stripNoiseWords(rawItem.description || rawItem.name || '');
      const matchResult = ProductMatcher.findBestMatch(normalizedDescription, catalogProducts);

      const resolvedSellPrice = matchResult.matchedProduct?.sellingPrice || (rawItem.unitPrice > 0 ? Math.round(rawItem.unitPrice * 1.25) : rawItem.unitPrice || 0);

      return {
        productName: normalizedDescription || rawItem.description,
        quantity: rawItem.quantity || 1,
        unitPrice: rawItem.unitPrice > 0 ? rawItem.unitPrice : resolvedSellPrice,
        purchasePrice: matchResult.matchedProduct?.purchasePrice || 0,
        total: (rawItem.quantity || 1) * (rawItem.unitPrice > 0 ? rawItem.unitPrice : resolvedSellPrice),
        matchedProductId: matchResult.matchedProduct?.id || null,
        matchedProduct: matchResult.matchedProduct || null,
        confidence: matchResult.confidence,
      };
    });

    return res.json({
      success: true,
      documentType: docResult.documentType || 'SALES_INVOICE',
      customerName: docResult.customerName || docResult.customer?.name || null,
      customerPhone: docResult.customerPhone || docResult.customer?.phone || null,
      invoiceNumber: docResult.invoiceNumber || null,
      invoiceDate: docResult.invoiceDate || new Date().toISOString().split('T')[0],
      items: reconciledItems,
      grandTotal: docResult.grandTotal || 0,
      confidence: docResult.confidence || { overall: 85 },
      rawText: docResult.rawText || '',
    });
  } catch (err) {
    console.error('Sales bill scan error:', err);
    return res.status(500).json({ error: 'Failed to process sales bill image', details: err.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
  }
});

export default router;
