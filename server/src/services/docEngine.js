import prisma from '../prisma.js';

export class DocEngine {
  // Create Quotation / Estimate
  static async createQuotation({ businessId, customerId, customerName, customerPhone, validUntil, items, discount = 0, notes }) {
    let subtotal = 0;
    const itemData = items.map(item => {
      const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
      subtotal += lineTotal;
      return {
        productId: item.productId || null,
        productName: item.productName,
        model: item.model || '',
        quality: item.quality || 'OEM',
        variant: item.variant || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        gstPercentage: item.gstPercentage || 18,
        total: lineTotal,
      };
    });

    const total = subtotal - discount;
    const count = await prisma.quotation.count({ where: { businessId } });
    const quoteNo = `EST-${1001 + count}`;

    return await prisma.quotation.create({
      data: {
        businessId,
        quoteNo,
        customerId,
        customerName,
        customerPhone,
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal,
        discount,
        total,
        notes,
        status: 'DRAFT',
        items: { create: itemData },
      },
      include: { items: true },
    });
  }

  // Convert Quotation to Sales Order
  static async convertQuoteToSalesOrder(quotationId) {
    const quote = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });

    if (!quote) throw new Error('Quotation not found');

    const count = await prisma.salesOrder.count({ where: { businessId: quote.businessId } });
    const orderNo = `SO-${1001 + count}`;

    const order = await prisma.salesOrder.create({
      data: {
        businessId: quote.businessId,
        orderNo,
        customerId: quote.customerId,
        customerName: quote.customerName,
        customerPhone: quote.customerPhone,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        status: 'CONFIRMED',
        notes: `Converted from estimate ${quote.quoteNo}`,
        items: {
          create: quote.items.map(i => ({
            productId: i.productId,
            productName: i.productName,
            model: i.model,
            quality: i.quality,
            variant: i.variant,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            total: i.total,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.quotation.update({
      where: { id: quotationId },
      data: { status: 'CONVERTED' },
    });

    return order;
  }

  // Create Delivery Challan
  static async createDeliveryChallan({ businessId, customerId, customerName, customerPhone, vehicleNo, transport, items, notes }) {
    const count = await prisma.deliveryChallan.count({ where: { businessId } });
    const challanNo = `DC-${1001 + count}`;

    return await prisma.deliveryChallan.create({
      data: {
        businessId,
        challanNo,
        customerId,
        customerName,
        customerPhone,
        vehicleNo,
        transport,
        notes,
        status: 'DELIVERED',
        items: {
          create: items.map(i => ({
            productId: i.productId || null,
            productName: i.productName,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    });
  }

  // Create Purchase Order
  static async createPurchaseOrder({ businessId, supplierId, supplierName, items, notes }) {
    let subtotal = 0;
    const itemData = items.map(item => {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      return {
        productId: item.productId || null,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: lineTotal,
      };
    });

    const count = await prisma.purchaseOrder.count({ where: { businessId } });
    const poNo = `PO-${1001 + count}`;

    return await prisma.purchaseOrder.create({
      data: {
        businessId,
        poNo,
        supplierId,
        supplierName,
        subtotal,
        total: subtotal,
        status: 'ORDERED',
        notes,
        items: { create: itemData },
      },
      include: { items: true },
    });
  }
}

export default DocEngine;
