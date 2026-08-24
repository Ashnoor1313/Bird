import express from 'express';
import prisma from '../prisma.js';
import { StockEngine } from '../services/StockEngine.js';

const router = express.Router();

// 1. GET ALL STOCK ORDERS (Purchase Orders for Godown Procurement)
router.get('/stock-orders', async (req, res) => {
  try {
    const { businessId, locationId, status } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };
    if (status && status !== 'ALL') where.status = status;
    if (locationId && locationId !== 'ALL') where.locationId = locationId;

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(orders);
  } catch (err) {
    console.error('Fetch stock orders error:', err);
    res.status(500).json({ error: 'Failed to fetch stock orders' });
  }
});

// 2. CREATE A NEW STOCK ORDER (Ordered Stock from Supplier)
router.post('/stock-orders', async (req, res) => {
  try {
    const {
      businessId,
      locationId,
      supplierId,
      supplierName,
      expectedDate,
      items, // [{ productId, productName, quantity, unitPrice }]
      notes,
    } = req.body;

    if (!businessId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'businessId and items array are required' });
    }

    const defaultGodown = await StockEngine.getDefaultGodown(businessId, prisma);
    const targetLocId = locationId || defaultGodown.id;

    let totalAmount = 0;
    const formattedItems = items.map((item) => {
      const qty = parseInt(item.quantity, 10) || 1;
      const rate = parseFloat(item.unitPrice) || 0;
      const lineTotal = qty * rate;
      totalAmount += lineTotal;

      return {
        productId: item.productId || null,
        productName: item.productName || 'Spare Part Item',
        quantity: qty,
        receivedQuantity: 0,
        unitPrice: rate,
        total: lineTotal,
      };
    });

    const poNo = `PO-${Date.now().toString().slice(-6)}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        businessId,
        locationId: targetLocId,
        poNo,
        supplierId: supplierId || null,
        supplierName: supplierName || 'Wholesale Mobile Supplier',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        subtotal: totalAmount,
        total: totalAmount,
        status: 'ORDERED',
        notes,
        items: {
          create: formattedItems,
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error('Create stock order error:', err);
    res.status(500).json({ error: 'Failed to create stock order' });
  }
});

// 3. RECEIVE STOCK FROM AN ORDER (Intake actual arrived pieces into Godown)
router.post('/stock-orders/receive', async (req, res) => {
  try {
    const { businessId, orderId, locationId, receivedItems, note, createdBy } = req.body;
    // receivedItems: [{ itemId, productId, receivedQuantity }]

    if (!businessId || !orderId || !receivedItems || !Array.isArray(receivedItems)) {
      return res.status(400).json({ error: 'businessId, orderId, and receivedItems array are required' });
    }

    const updatedOrder = await StockEngine.receiveStockOrder({
      businessId,
      orderId,
      receivedItems,
      locationId,
      note,
      createdBy,
    });

    res.json({
      message: 'Stock successfully received and added to Godown inventory!',
      order: updatedOrder,
    });
  } catch (err) {
    console.error('Receive stock order error:', err);
    res.status(500).json({ error: err.message || 'Failed to receive stock order' });
  }
});

// ==========================================
// 4. QUOTATIONS / ESTIMATES MODULE
// ==========================================
router.get('/quotations', async (req, res) => {
  try {
    const { businessId, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };
    if (locationId && locationId !== 'ALL') where.locationId = locationId;

    const quotes = await prisma.quotation.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotes);
  } catch (err) {
    console.error('Fetch quotations error:', err);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
});

router.get('/quotations/:id', async (req, res) => {
  try {
    const quote = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotation details' });
  }
});

router.post('/quotations', async (req, res) => {
  try {
    const {
      businessId,
      locationId,
      customerId,
      customerName,
      customerPhone,
      validUntil,
      items = [],
      discount = 0,
      notes,
    } = req.body;

    if (!businessId || !items || items.length === 0) {
      return res.status(400).json({ error: 'businessId and items are required' });
    }

    let subtotal = 0;
    const formattedItems = items.map(item => {
      const qty = parseInt(item.quantity, 10) || 1;
      const rate = parseFloat(item.unitPrice) || 0;
      const itemDisc = parseFloat(item.discount || 0);
      const lineTotal = qty * rate - itemDisc;
      subtotal += lineTotal;

      return {
        productId: item.productId || null,
        productName: item.productName || 'Spare Part Item',
        model: item.model || null,
        quality: item.quality || null,
        variant: item.variant || null,
        quantity: qty,
        unitPrice: rate,
        discount: itemDisc,
        gstPercentage: parseFloat(item.gstPercentage || 18.0),
        total: lineTotal,
      };
    });

    const disc = parseFloat(discount || 0);
    const total = Math.max(0, subtotal - disc);
    const quoteNo = `QT-${Date.now().toString().slice(-6)}`;

    const quote = await prisma.quotation.create({
      data: {
        businessId,
        locationId: locationId && locationId !== 'ALL' ? locationId : null,
        quoteNo,
        customerId: customerId || null,
        customerName: customerName || 'Valued Customer',
        customerPhone: customerPhone || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal,
        discount: disc,
        total,
        notes,
        status: 'DRAFT',
        items: {
          create: formattedItems,
        },
      },
      include: { items: true },
    });

    res.status(201).json(quote);
  } catch (err) {
    console.error('Create quotation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create quotation' });
  }
});

// Convert Quotation into Sales Order
router.post('/quotations/:id/convert', async (req, res) => {
  try {
    const quote = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!quote) return res.status(404).json({ error: 'Quotation not found' });

    const orderNo = `SO-${Date.now().toString().slice(-6)}`;
    const salesOrder = await prisma.salesOrder.create({
      data: {
        businessId: quote.businessId,
        locationId: quote.locationId,
        orderNo,
        customerId: quote.customerId,
        customerName: quote.customerName,
        customerPhone: quote.customerPhone,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        advancePaid: 0,
        status: 'CONFIRMED',
        notes: `Converted from Quotation #${quote.quoteNo}. ${quote.notes || ''}`,
        items: {
          create: quote.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            model: item.model,
            quality: item.quality,
            variant: item.variant,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.quotation.update({
      where: { id: quote.id },
      data: { status: 'CONVERTED' },
    });

    res.status(201).json(salesOrder);
  } catch (err) {
    console.error('Convert quotation error:', err);
    res.status(500).json({ error: err.message || 'Failed to convert quotation' });
  }
});

// ==========================================
// 5. SALES ORDERS & DELIVERY CHALLANS
// ==========================================
router.get('/sales-orders', async (req, res) => {
  try {
    const { businessId, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };
    if (locationId && locationId !== 'ALL') where.locationId = locationId;

    const orders = await prisma.salesOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales orders' });
  }
});

router.post('/sales-orders', async (req, res) => {
  try {
    const {
      businessId,
      locationId,
      customerId,
      customerName,
      customerPhone,
      items = [],
      discount = 0,
      advancePaid = 0,
      notes,
    } = req.body;

    if (!businessId || !items || items.length === 0) {
      return res.status(400).json({ error: 'businessId and items are required' });
    }

    let subtotal = 0;
    const formattedItems = items.map(item => {
      const qty = parseInt(item.quantity, 10) || 1;
      const rate = parseFloat(item.unitPrice) || 0;
      const itemDisc = parseFloat(item.discount || 0);
      const lineTotal = qty * rate - itemDisc;
      subtotal += lineTotal;

      return {
        productId: item.productId || null,
        productName: item.productName || 'Spare Part Item',
        model: item.model || null,
        quality: item.quality || null,
        variant: item.variant || null,
        quantity: qty,
        unitPrice: rate,
        discount: itemDisc,
        total: lineTotal,
      };
    });

    const disc = parseFloat(discount || 0);
    const total = Math.max(0, subtotal - disc);
    const orderNo = `SO-${Date.now().toString().slice(-6)}`;

    const order = await prisma.salesOrder.create({
      data: {
        businessId,
        locationId: locationId && locationId !== 'ALL' ? locationId : null,
        orderNo,
        customerId: customerId || null,
        customerName: customerName || 'Customer',
        customerPhone: customerPhone || null,
        subtotal,
        discount: disc,
        total,
        advancePaid: parseFloat(advancePaid || 0),
        status: 'CONFIRMED',
        notes,
        items: {
          create: formattedItems,
        },
      },
      include: { items: true },
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create sales order' });
  }
});

router.get('/delivery-challans', async (req, res) => {
  try {
    const { businessId, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };
    if (locationId && locationId !== 'ALL') where.locationId = locationId;

    const challans = await prisma.deliveryChallan.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch delivery challans' });
  }
});

router.post('/delivery-challans', async (req, res) => {
  try {
    const {
      businessId,
      locationId,
      customerId,
      customerName,
      customerPhone,
      vehicleNo,
      transport,
      notes,
      items = [],
    } = req.body;

    if (!businessId || !items || items.length === 0) {
      return res.status(400).json({ error: 'businessId and items are required' });
    }

    const challanNo = `DC-${Date.now().toString().slice(-6)}`;
    const challan = await prisma.deliveryChallan.create({
      data: {
        businessId,
        locationId: locationId && locationId !== 'ALL' ? locationId : null,
        challanNo,
        customerId: customerId || null,
        customerName: customerName || 'Customer',
        customerPhone: customerPhone || null,
        vehicleNo,
        transport,
        notes,
        status: 'DELIVERED',
        items: {
          create: items.map(item => ({
            productId: item.productId || null,
            productName: item.productName || 'Spare Part',
            quantity: parseInt(item.quantity, 10) || 1,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(challan);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create delivery challan' });
  }
});

export default router;
