import express from 'express';
import prisma from '../prisma.js';
import * as XLSX from 'xlsx';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();


// DASHBOARD OVERVIEW SUMMARY (Location-Aware & Complete Store/Category Metrics)
router.get('/dashboard', async (req, res) => {
  try {
    const { businessId, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    // Fetch all active locations for business
    const locations = await prisma.location.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    const isLocationSpecific = locationId && locationId !== 'ALL';
    const activeLoc = isLocationSpecific ? locations.find(l => l.id === locationId) : null;

    // Today's Start
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Sales filters
    let baseSalesWhere = { businessId };
    if (isLocationSpecific) baseSalesWhere.locationId = locationId;

    // Fetch all sales for this location/business to calculate overall & category metrics
    const salesList = await prisma.sale.findMany({
      where: baseSalesWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { items: true } },
      },
    });

    let totalSales = 0;
    let todaySales = 0;
    let totalBillsCount = salesList.length;
    let todayBillsCount = 0;
    let totalDueAmount = 0;

    let foldersTotalSales = 0;
    let foldersTodaySales = 0;
    let foldersBillsCount = 0;
    let foldersTodayBillsCount = 0;

    let batteriesTotalSales = 0;
    let batteriesTodaySales = 0;
    let batteriesBillsCount = 0;
    let batteriesTodayBillsCount = 0;

    for (const s of salesList) {
      const amt = s.total || 0;
      const isToday = new Date(s.createdAt) >= todayStart;
      const isBattery = s.categoryId && /batter|cell|mah/i.test(s.categoryId);

      totalSales += amt;
      totalDueAmount += (s.dueAmount || 0);

      if (isToday) {
        todaySales += amt;
        todayBillsCount++;
      }

      if (isBattery) {
        batteriesTotalSales += amt;
        batteriesBillsCount++;
        if (isToday) {
          batteriesTodaySales += amt;
          batteriesTodayBillsCount++;
        }
      } else {
        foldersTotalSales += amt;
        foldersBillsCount++;
        if (isToday) {
          foldersTodaySales += amt;
          foldersTodayBillsCount++;
        }
      }
    }

    // Purchases filter
    let purchasesWhere = { businessId };
    if (isLocationSpecific) purchasesWhere.receivingLocationId = locationId;

    const allPurchasesList = await prisma.purchase.findMany({
      where: purchasesWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const totalPurchasesAgg = await prisma.purchase.aggregate({
      where: purchasesWhere,
      _sum: { total: true },
    });

    const todayPurchasesAgg = await prisma.purchase.aggregate({
      where: { ...purchasesWhere, createdAt: { gte: todayStart } },
      _sum: { total: true },
    });

    // Customers & Receivables
    const customerWhere = isLocationSpecific ? { businessId, locationId } : { businessId };
    const allCustomers = await prisma.customer.findMany({
      where: customerWhere,
    });

    let moneyToReceive = 0;
    let foldersReceivables = 0;
    let batteriesReceivables = 0;

    for (const c of allCustomers) {
      const due = c.moneyToReceive || 0;
      moneyToReceive += due;
      if (c.categoryId && /batter/i.test(c.categoryId)) {
        batteriesReceivables += due;
      } else {
        foldersReceivables += due;
      }
    }

    // Supplier Payables
    const supplierWhere = isLocationSpecific ? { businessId, locationId } : { businessId };
    const allSuppliers = await prisma.supplier.findMany({
      where: supplierWhere,
    });

    let moneyToPay = 0;
    for (const sup of allSuppliers) {
      moneyToPay += (sup.moneyToPay || 0);
    }

    // Fetch Products with Category and Location Stocks
    const products = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        category: true,
        locationStocks: {
          include: { location: true },
        },
      },
    });

    let totalStockValue = 0;
    let totalStockPcs = 0;
    let foldersStockPcs = 0;
    let foldersStockValue = 0;
    let foldersProductCount = 0;
    let foldersLowStockCount = 0;
    let batteriesStockPcs = 0;
    let batteriesStockValue = 0;
    let batteriesProductCount = 0;
    let batteriesLowStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let lowStockProducts = [];

    const isGodownLoc = !isLocationSpecific || activeLoc?.type === 'GODOWN' || /godown|warehouse|central/i.test(activeLoc?.name || '');

    products.forEach(p => {
      let qty = p.currentStock || 0;
      if (isLocationSpecific) {
        const locStock = p.locationStocks?.find(ls => ls.locationId === locationId);
        if (locStock) {
          qty = (locStock.goodStock !== undefined ? locStock.goodStock : locStock.quantity) || 0;
        } else if (isGodownLoc) {
          qty = p.currentStock || 0;
        } else {
          qty = 0;
        }
      }

      const costPrice = p.purchasePrice || 0;
      const val = qty * costPrice;

      totalStockValue += val;
      totalStockPcs += qty;

      const isBattery = /batter|cell|mah/i.test(p.name) ||
                        /batter|cell|mah/i.test(p.category?.name || '') ||
                        p.partType === 'Battery';
      const isFolder = !isBattery;

      if (isFolder) {
        foldersStockPcs += qty;
        foldersStockValue += val;
        foldersProductCount++;
        if (qty <= (p.minStock || 5) && qty > 0) foldersLowStockCount++;
      } else if (isBattery) {
        batteriesStockPcs += qty;
        batteriesStockValue += val;
        batteriesProductCount++;
        if (qty <= (p.minStock || 5) && qty > 0) batteriesLowStockCount++;
      }

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= (p.minStock || 5)) {
        lowStockCount++;
        lowStockProducts.push({
          ...p,
          currentStock: qty,
        });
      }
    });

    // Location-wise Summary breakdown for Business-wide view
    const locationSummaries = [];
    if (!isLocationSpecific) {
      for (const loc of locations) {
        const locSales = salesList.filter(s => s.locationId === loc.id);
        const locTotal = locSales.reduce((a, b) => a + (b.total || 0), 0);
        const locToday = locSales.filter(s => new Date(s.createdAt) >= todayStart).reduce((a, b) => a + (b.total || 0), 0);

        locationSummaries.push({
          location: loc,
          totalSales: locTotal,
          todaySales: locToday,
          billsCount: locSales.length,
          stockValue: Math.round(totalStockValue),
          totalStockPcs,
        });
      }
    }

    // Stock Ordered & Received Metrics
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { businessId },
      include: { items: true },
    });

    let stockOrderedPcs = 0;
    let stockReceivedPcs = 0;
    purchaseOrders.forEach(o => {
      o.items.forEach(i => {
        stockOrderedPcs += i.quantity;
        stockReceivedPcs += i.receivedQuantity || 0;
      });
    });

    // Group Category Stock List (Folders vs Batteries)
    const categoryStockList = [
      {
        id: 'folders-cat',
        name: 'Folders',
        totalPcs: foldersStockPcs,
        productCount: foldersProductCount,
        stockValue: Math.round(foldersStockValue),
        totalSales: foldersTotalSales,
        todaySales: foldersTodaySales,
        billsCount: foldersBillsCount,
      },
      {
        id: 'batteries-cat',
        name: 'Batteries',
        totalPcs: batteriesStockPcs,
        productCount: batteriesProductCount,
        stockValue: Math.round(batteriesStockValue),
        totalSales: batteriesTotalSales,
        todaySales: batteriesTodaySales,
        billsCount: batteriesBillsCount,
      },
    ];

    res.json({
      activeLocation: activeLoc,
      locations,
      locationSummaries,
      totalSales,
      todaySales,
      totalBillsCount,
      todayBillsCount,
      totalDueAmount,
      foldersTotalSales,
      foldersTodaySales,
      foldersBillsCount,
      foldersTodayBillsCount,
      foldersStockPcs,
      foldersStockValue: Math.round(foldersStockValue),
      foldersProductCount,
      foldersLowStockCount,
      foldersReceivables,
      batteriesTotalSales,
      batteriesTodaySales,
      batteriesBillsCount,
      batteriesTodayBillsCount,
      batteriesStockPcs,
      batteriesStockValue: Math.round(batteriesStockValue),
      batteriesProductCount,
      batteriesLowStockCount,
      batteriesReceivables,
      todayPurchases: todayPurchasesAgg._sum.total || 0,
      totalPurchases: totalPurchasesAgg._sum.total || 0,
      moneyToReceive,
      moneyToPay,
      totalCustomers: allCustomers.length,
      totalSuppliers: allSuppliers.length,
      stockValue: Math.round(totalStockValue),
      totalStockPcs,
      lowStockCount,
      outOfStockCount,
      stockOrderedPcs,
      stockReceivedPcs,
      categoryStockList,
      totalProductsCount: products.length,
      recentBills: salesList.slice(0, 8),
      recentPurchases: allPurchasesList,
      lowStockProducts: lowStockProducts.slice(0, 5),
    });

  } catch (err) {
    console.error('Dashboard Overview Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// CATEGORY HUB COMPLETE WORKSPACE ENDPOINT (Central Godown Single Source of Truth)
router.get('/category-hub', async (req, res) => {
  try {
    const { businessId, categoryName, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const targetCategoryName = categoryName || 'Folders';
    const isLocationSpecific = locationId && locationId !== 'ALL';

    // 1. Find categories
    const categories = await prisma.category.findMany({
      where: { businessId },
    });

    const isBattery = /batter|cell|mah/i.test(targetCategoryName);
    const matchingCatIds = categories
      .filter(c => isBattery ? /batter|cell|mah/i.test(c.name) : /folder|display|screen|lcd|oled/i.test(c.name))
      .map(c => c.id);

    // 2. Fetch all products in this category
    const batteryCatIds = categories
      .filter(c => /batter|cell|mah/i.test(c.name))
      .map(c => c.id);

    const productsWhere = {
      businessId,
      status: 'ACTIVE',
    };

    if (isBattery) {
      productsWhere.OR = [
        { categoryId: { in: matchingCatIds } },
        { partType: 'Battery' },
        { name: { contains: 'Battery' } },
        { name: { contains: 'Cell' } },
      ];
    } else {
      productsWhere.NOT = [
        { categoryId: { in: batteryCatIds } },
        { partType: 'Battery' },
      ];
    }

    const allProducts = await prisma.product.findMany({
      where: productsWhere,
      include: {
        category: true,
        locationStocks: {
          include: { location: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 3. Fetch all active locations
    const locations = await prisma.location.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    const activeLoc = isLocationSpecific ? locations.find(l => l.id === locationId) : null;
    const isGodownLoc = !isLocationSpecific || activeLoc?.type === 'GODOWN' || /godown|warehouse|central/i.test(activeLoc?.name || '');

    // 4. Calculate Category Stock Metrics
    let totalStockPcs = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const productList = allProducts.map(p => {
      let qty = p.currentStock || 0;
      let goodQty = p.goodStock || p.currentStock || 0;
      let defectiveQty = p.defectiveStock || 0;
      let testingQty = p.testingStock || 0;

      if (isLocationSpecific) {
        const ls = p.locationStocks?.find(s => s.locationId === locationId);
        if (ls) {
          qty = ls.goodStock !== undefined ? ls.goodStock : ls.quantity;
          goodQty = ls.goodStock !== undefined ? ls.goodStock : qty;
          defectiveQty = ls.defectiveStock || 0;
          testingQty = ls.testingStock || 0;
        } else if (isGodownLoc) {
          qty = p.currentStock || 0;
          goodQty = p.goodStock || p.currentStock || 0;
        } else {
          qty = 0;
          goodQty = 0;
          defectiveQty = 0;
          testingQty = 0;
        }
      }

      totalStockPcs += qty;
      totalStockValue += qty * (p.purchasePrice || 0);

      if (qty <= 0) outOfStockCount++;
      else if (qty <= (p.minStock || 5)) lowStockCount++;

      return {
        ...p,
        displayQty: qty,
        locationStockQuantity: qty,
        locationGoodStock: goodQty,
        locationDefectiveStock: defectiveQty,
        locationTestingStock: testingQty,
      };
    });

    // 5. Calculate Location Breakdown (Godown, Store 1, Store 2, etc.)
    const locationBreakdown = locations.map(loc => {
      let locPcs = 0;
      let locVal = 0;
      allProducts.forEach(p => {
        const ls = p.locationStocks.find(s => s.locationId === loc.id);
        const q = ls ? ls.quantity : 0;
        locPcs += q;
        locVal += q * (p.purchasePrice || 0);
      });
      return {
        locationId: loc.id,
        locationName: loc.name,
        locationType: loc.type,
        totalPcs: locPcs,
        stockValue: Math.round(locVal),
      };
    });

    // 6. Fetch Sales & Invoices relating to this category or its products
    const targetCatCode = isBattery ? 'batteries' : 'folders';
    const productIds = allProducts.map(p => p.id);
    let salesWhere = {
      businessId,
      OR: [
        { categoryId: targetCatCode },
        {
          items: {
            some: {
              productId: { in: productIds },
            },
          },
        },
      ],
    };
    if (isLocationSpecific) {
      salesWhere.locationId = locationId;
    }

    const sales = await prisma.sale.findMany({
      where: salesWhere,
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

    // Calculate Category-Specific Sales Totals & Daily Sales
    let categorySalesTotal = 0;
    let categoryItemsSold = 0;
    const customerMap = new Map();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let todayCategorySales = 0;

    sales.forEach(sale => {
      let saleCategoryAmt = 0;
      const isDirectCategorySale = sale.categoryId === targetCatCode;

      if (isDirectCategorySale) {
        saleCategoryAmt = sale.total || sale.subtotal || 0;
        categoryItemsSold += sale.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
      } else {
        sale.items?.forEach(item => {
          if (productIds.includes(item.productId)) {
            const itemAmt = item.total || (item.quantity * item.unitPrice);
            saleCategoryAmt += itemAmt;
            categoryItemsSold += (item.quantity || 1);
          }
        });
      }

      categorySalesTotal += saleCategoryAmt;
      if (new Date(sale.createdAt) >= todayStart) {
        todayCategorySales += saleCategoryAmt;
      }

      // Aggregate Customer Transactions
      if (sale.customer) {
        const cId = sale.customer.id;
        if (!customerMap.has(cId)) {
          customerMap.set(cId, {
            id: sale.customer.id,
            name: sale.customer.name,
            phone: sale.customer.phone,
            priceLevel: sale.customer.priceLevel || 'RETAIL',
            moneyToReceive: sale.customer.moneyToReceive || 0,
            totalCategorySpend: 0,
            totalCategoryPieces: 0,
            invoicesCount: 0,
            lastPurchaseDate: sale.createdAt,
          });
        }
        const cData = customerMap.get(cId);
        cData.totalCategorySpend += saleCategoryAmt;
        cData.totalCategoryPieces += sale.items.reduce((s, i) => productIds.includes(i.productId) ? s + i.quantity : s, 0);
        cData.invoicesCount += 1;
      }
    });

    // Also include all business customers so POS and Customer directory have complete data
    const allBusinessCustomers = await prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });

    allBusinessCustomers.forEach(cust => {
      if (!customerMap.has(cust.id)) {
        customerMap.set(cust.id, {
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          priceLevel: cust.priceLevel || 'RETAIL',
          moneyToReceive: cust.moneyToReceive || 0,
          totalSales: cust.totalSales || 0,
          totalCategorySpend: 0,
          totalCategoryPieces: 0,
          invoicesCount: 0,
          lastPurchaseDate: null,
        });
      } else {
        const existing = customerMap.get(cust.id);
        existing.priceLevel = cust.priceLevel || 'RETAIL';
        existing.totalSales = cust.totalSales || 0;
      }
    });

    const customerList = Array.from(customerMap.values()).sort((a, b) => b.totalCategorySpend - a.totalCategorySpend || a.name.localeCompare(b.name));
    const customerIds = customerList.map(c => c.id);

    // Fetch Category Customers Payments & Ledgers
    let paymentsWhere = {
      businessId,
      customerId: { in: customerIds },
    };
    if (isLocationSpecific) {
      paymentsWhere.locationId = locationId;
    }

    const payments = await prisma.payment.findMany({
      where: paymentsWhere,
      include: {
        customer: true,
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const ledgers = await prisma.customerLedger.findMany({
      where: {
        businessId,
        customerId: { in: customerIds },
        ...(isLocationSpecific ? { locationId } : {}),
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      categoryName: targetCategoryName,
      locationId: locationId || 'ALL',
      locations,
      totalProductsCount: allProducts.length,
      totalStockPcs,
      totalStockValue: Math.round(totalStockValue),
      lowStockCount,
      outOfStockCount,
      locationBreakdown,
      categorySalesTotal: Math.round(categorySalesTotal),
      todayCategorySales: Math.round(todayCategorySales),
      categoryItemsSold,
      invoicesCount: sales.length,
      products: productList,
      sales,
      customers: customerList,
      payments,
      ledgers,
    });
  } catch (err) {
    console.error('Category Hub Error:', err);
    res.status(500).json({ error: 'Failed to fetch category hub data' });
  }
});

// GST REPORT
router.get('/gst', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const salesGst = await prisma.sale.aggregate({
      where: { businessId },
      _sum: { cgst: true, sgst: true, igst: true, total: true, subtotal: true },
    });

    const purchasesGst = await prisma.purchase.aggregate({
      where: { businessId },
      _sum: { cgst: true, sgst: true, igst: true, total: true, subtotal: true },
    });

    res.json({
      sales: {
        subtotal: salesGst._sum.subtotal || 0,
        cgst: salesGst._sum.cgst || 0,
        sgst: salesGst._sum.sgst || 0,
        igst: salesGst._sum.igst || 0,
        totalGst: (salesGst._sum.cgst || 0) + (salesGst._sum.sgst || 0) + (salesGst._sum.igst || 0),
        total: salesGst._sum.total || 0,
      },
      purchases: {
        subtotal: purchasesGst._sum.subtotal || 0,
        cgst: purchasesGst._sum.cgst || 0,
        sgst: purchasesGst._sum.sgst || 0,
        igst: purchasesGst._sum.igst || 0,
        totalGst: (purchasesGst._sum.cgst || 0) + (purchasesGst._sum.sgst || 0) + (purchasesGst._sum.igst || 0),
        total: purchasesGst._sum.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate GST report' });
  }
});

// ANALYTICS & GRAPHICAL DATA REPORT ENDPOINT (Location & TimeRange Aware)
router.get('/analytics', async (req, res) => {
  try {
    const { businessId, locationId, timeRange = 'ALL', startDate: customStart, endDate: customEnd, limit = 50 } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const isLocationSpecific = locationId && locationId !== 'ALL';
    const now = new Date();

    // Calculate time filter boundaries & preceding comparison period
    let startDate = null;
    let endDate = customEnd ? new Date(customEnd) : now;
    let prevStartDate = null;
    let prevEndDate = null;
    let intervalType = 'MONTH'; // 'DAY', 'WEEK', 'MONTH'

    if (customStart) {
      startDate = new Date(customStart);
      const diffMs = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime());
      prevStartDate = new Date(prevEndDate.getTime() - diffMs);
      intervalType = diffMs <= 31 * 24 * 60 * 60 * 1000 ? 'DAY' : 'MONTH';
    } else if (timeRange === '7D') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
      prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      intervalType = 'DAY';
    } else if (timeRange === '15D') {
      startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
      prevStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      intervalType = 'DAY';
    } else if (timeRange === '1M') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
      prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      intervalType = 'DAY';
    } else if (timeRange === '3M') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
      prevStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      intervalType = 'WEEK';
    } else if (timeRange === '6M') {
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
      prevStartDate = new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000);
      intervalType = 'MONTH';
    } else if (timeRange === '1Y') {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
      prevStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
      intervalType = 'MONTH';
    }

    // Base filters
    const baseSalesWhere = {
      businessId,
      status: 'COMPLETED',
      ...(isLocationSpecific ? { locationId } : {}),
    };

    const currentSalesWhere = {
      ...baseSalesWhere,
      ...(startDate ? { saleDate: { gte: startDate, lte: endDate } } : {}),
    };

    const prevSalesWhere = prevStartDate ? {
      ...baseSalesWhere,
      saleDate: { gte: prevStartDate, lte: prevEndDate },
    } : null;

    const purchasesWhere = {
      businessId,
      status: 'COMPLETED',
      ...(isLocationSpecific ? { receivingLocationId: locationId } : {}),
      ...(startDate ? { purchaseDate: { gte: startDate, lte: endDate } } : {}),
    };

    const paymentsWhere = {
      businessId,
      ...(isLocationSpecific ? { locationId } : {}),
      ...(startDate ? { date: { gte: startDate, lte: endDate } } : {}),
    };

    const expensesWhere = {
      businessId,
      ...(isLocationSpecific ? { locationId } : {}),
      ...(startDate ? { date: { gte: startDate, lte: endDate } } : {}),
    };

    const customersWhere = {
      businessId,
      ...(isLocationSpecific ? { locationId } : {}),
    };

    const suppliersWhere = {
      businessId,
      ...(isLocationSpecific ? { locationId } : {}),
    };

    // Parallel fetch
    const [
      sales,
      prevSales,
      purchases,
      payments,
      expenses,
      customers,
      suppliers,
      products,
      activeLoc,
      allLocations,
      accountBalances,
      categories
    ] = await Promise.all([
      prisma.sale.findMany({
        where: currentSalesWhere,
        include: {
          items: {
            include: { product: { include: { category: true } } },
          },
        },
        orderBy: { saleDate: 'asc' },
      }),
      prevSalesWhere ? prisma.sale.findMany({ where: prevSalesWhere }) : Promise.resolve([]),
      prisma.purchase.findMany({
        where: purchasesWhere,
        include: { items: true },
        orderBy: { purchaseDate: 'asc' },
      }),
      prisma.payment.findMany({ where: paymentsWhere }),
      prisma.expense.findMany({ where: expensesWhere }),
      prisma.customer.findMany({ where: customersWhere }),
      prisma.supplier.findMany({ where: suppliersWhere }),
      prisma.product.findMany({
        where: { businessId, status: 'ACTIVE' },
        include: { category: true, locationStocks: true },
      }),
      isLocationSpecific ? prisma.location.findUnique({ where: { id: locationId } }) : null,
      prisma.location.findMany({ where: { businessId, status: 'ACTIVE' } }),
      prisma.accountBalance.findMany({
        where: {
          businessId,
          ...(isLocationSpecific ? { locationId } : {}),
        },
      }),
      prisma.category.findMany({ where: { businessId } }),
    ]);

    // 1. Financial Totals
    const totalSalesAmount = sales.reduce((acc, s) => acc + (s.total || 0), 0);
    const prevSalesAmount = prevSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const salesGrowthPct = prevSalesAmount > 0
      ? Math.round(((totalSalesAmount - prevSalesAmount) / prevSalesAmount) * 100)
      : (totalSalesAmount > 0 ? 100 : 0);

    const totalPurchaseAmount = purchases.reduce((acc, p) => acc + (p.total || 0), 0);
    const totalExpensesAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

    let moneyReceived = 0;
    let moneyPaid = 0;
    let cashBalance = accountBalances.reduce((acc, b) => acc + (b.cashBalance || 0), 0);
    let bankBalance = accountBalances.reduce((acc, b) => acc + (b.bankBalance || 0), 0);
    let upiBalance = accountBalances.reduce((acc, b) => acc + (b.upiBalance || 0), 0);

    let cashSales = 0;
    let upiSales = 0;
    let creditDueSales = 0;

    sales.forEach(s => {
      const pMethod = (s.paymentMethod || 'CASH').toUpperCase();
      if (pMethod === 'CASH') cashSales += (s.paidAmount || 0);
      else if (pMethod === 'UPI') upiSales += (s.paidAmount || 0);
      else cashSales += (s.paidAmount || 0);
      creditDueSales += (s.dueAmount || 0);
    });

    payments.forEach(pay => {
      const pMethod = (pay.paymentMethod || 'CASH').toUpperCase();
      if (pay.type === 'RECEIVE') {
        moneyReceived += pay.amount;
        if (pMethod === 'CASH') cashBalance += pay.amount;
        else if (pMethod === 'UPI') upiBalance += pay.amount;
        else bankBalance += pay.amount;
      } else if (pay.type === 'PAY') {
        moneyPaid += pay.amount;
        if (pMethod === 'CASH') cashBalance = Math.max(0, cashBalance - pay.amount);
        else if (pMethod === 'UPI') upiBalance = Math.max(0, upiBalance - pay.amount);
        else bankBalance = Math.max(0, bankBalance - pay.amount);
      }
    });

    const endingAmount = Math.max(0, cashBalance + bankBalance + upiBalance);
    const totalReceivables = customers.reduce((acc, c) => acc + (c.moneyToReceive || 0), 0);
    const totalPayables = suppliers.reduce((acc, s) => acc + (s.moneyToPay || 0), 0);

    // 2. Timeline Aggregation for Colored Graphs
    const timelineMap = new Map();

    const formatDateKey = (dateObj) => {
      const d = new Date(dateObj);
      if (intervalType === 'DAY') {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); // e.g. "19 Aug"
      } else if (intervalType === 'WEEK') {
        const weekNum = Math.ceil(d.getDate() / 7);
        return `W${weekNum} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
      } else {
        return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); // e.g. "Aug 26"
      }
    };

    // Pre-populate timeline slots for smooth continuous curves
    if (intervalType === 'DAY') {
      const numDays = timeRange === '7D' ? 7 : (timeRange === '15D' ? 15 : 30);
      for (let i = numDays - 1; i >= 0; i--) {
        const pastDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = formatDateKey(pastDate);
        if (!timelineMap.has(key)) {
          timelineMap.set(key, {
            name: key,
            date: pastDate.toISOString().split('T')[0],
            sales: 0,
            foldersSales: 0,
            batteriesSales: 0,
            profit: 0,
            purchases: 0,
            billsCount: 0,
          });
        }
      }
    } else if (intervalType === 'MONTH') {
      const numMonths = timeRange === '6M' ? 6 : (timeRange === '1Y' ? 12 : 6);
      for (let i = numMonths - 1; i >= 0; i--) {
        const pastDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = formatDateKey(pastDate);
        if (!timelineMap.has(key)) {
          timelineMap.set(key, {
            name: key,
            date: pastDate.toISOString().split('T')[0],
            sales: 0,
            foldersSales: 0,
            batteriesSales: 0,
            profit: 0,
            purchases: 0,
            billsCount: 0,
          });
        }
      }
    }

    // Helper to check category: strictly Folders vs Batteries
    const isBatteryItem = (item, sale) => {
      const catName = item?.product?.category?.name || '';
      const prodName = item?.productName || item?.product?.name || '';
      const saleCat = sale?.categoryId || '';
      return /batter|cell|mah/i.test(catName) ||
             /batter|cell|mah/i.test(prodName) ||
             /batter/i.test(saleCat) ||
             item?.product?.partType === 'Battery';
    };

    // Aggregate Sales into Timeline & Category Breakdown
    let foldersTotalSales = 0;
    let foldersTotalProfit = 0;
    let foldersPiecesSold = 0;
    let foldersBillsCount = 0;
    const foldersBillsSet = new Set();

    let batteriesTotalSales = 0;
    let batteriesTotalProfit = 0;
    let batteriesPiecesSold = 0;
    let batteriesBillsCount = 0;
    const batteriesBillsSet = new Set();

    const folderProductsMap = {};
    const batteryProductsMap = {};

    sales.forEach(s => {
      const sDate = s.saleDate || s.createdAt;
      const key = formatDateKey(sDate);

      if (!timelineMap.has(key)) {
        timelineMap.set(key, {
          name: key,
          date: new Date(sDate).toISOString().split('T')[0],
          sales: 0,
          foldersSales: 0,
          batteriesSales: 0,
          profit: 0,
          purchases: 0,
          billsCount: 0,
        });
      }

      const point = timelineMap.get(key);
      const saleTotal = s.total || 0;
      point.sales += Math.round(saleTotal);
      point.billsCount += 1;

      let saleEstimatedProfit = 0;

      // Process line items
      if (s.items && s.items.length > 0) {
        s.items.forEach(item => {
          const isBat = isBatteryItem(item, s);
          const qty = item.quantity || 1;
          const lineTotal = item.total || (qty * item.unitPrice) || 0;
          const cost = item.purchasePrice || item.product?.purchasePrice || (item.unitPrice * 0.75);
          const profit = lineTotal - (cost * qty);

          saleEstimatedProfit += profit;

          const prodKey = (item.productName?.trim() || item.product?.name || 'Mobile Spare Part').trim();
          const targetMap = isBat ? batteryProductsMap : folderProductsMap;

          if (!targetMap[prodKey]) {
            targetMap[prodKey] = {
              name: prodKey,
              piecesSold: 0,
              totalRevenue: 0,
              grossProfit: 0,
              purchasePrice: item.purchasePrice || item.product?.purchasePrice || 0,
              sellingPrice: item.unitPrice || item.product?.sellingPrice || 0,
              currentStock: item.product?.currentStock || 0,
            };
          }

          targetMap[prodKey].piecesSold += qty;
          targetMap[prodKey].totalRevenue += Math.round(lineTotal);
          targetMap[prodKey].grossProfit += Math.round(profit);

          if (isBat) {
            batteriesTotalSales += lineTotal;
            batteriesTotalProfit += profit;
            batteriesPiecesSold += qty;
            batteriesBillsSet.add(s.id);
            point.batteriesSales += Math.round(lineTotal);
          } else {
            foldersTotalSales += lineTotal;
            foldersTotalProfit += profit;
            foldersPiecesSold += qty;
            foldersBillsSet.add(s.id);
            point.foldersSales += Math.round(lineTotal);
          }
        });
      } else {
        // Fallback for sales without line items (using categoryId)
        const isBat = s.categoryId && /batter/i.test(s.categoryId);
        const estimatedProfit = saleTotal * 0.25;
        saleEstimatedProfit += estimatedProfit;

        if (isBat) {
          batteriesTotalSales += saleTotal;
          batteriesTotalProfit += estimatedProfit;
          batteriesBillsSet.add(s.id);
          point.batteriesSales += Math.round(saleTotal);
        } else {
          foldersTotalSales += saleTotal;
          foldersTotalProfit += estimatedProfit;
          foldersBillsSet.add(s.id);
          point.foldersSales += Math.round(saleTotal);
        }
      }

      point.profit += Math.round(saleEstimatedProfit);
    });

    // Populate purchases in timeline
    purchases.forEach(p => {
      const pDate = p.purchaseDate || p.createdAt;
      const key = formatDateKey(pDate);
      if (timelineMap.has(key)) {
        timelineMap.get(key).purchases += Math.round(p.total || 0);
      }
    });

    const timelineData = Array.from(timelineMap.values());

    // 3. Category Stock & Valuations (Folders & Batteries)
    let foldersStockPcs = 0;
    let foldersStockValue = 0;
    let batteriesStockPcs = 0;
    let batteriesStockValue = 0;

    products.forEach(p => {
      let qty = 0;
      if (isLocationSpecific) {
        const ls = p.locationStocks?.find(s => s.locationId === locationId);
        qty = ls ? (ls.goodStock !== undefined ? ls.goodStock : ls.quantity) : 0;
      } else {
        qty = p.goodStock !== undefined ? p.goodStock : p.currentStock;
      }

      const val = (qty || 0) * (p.purchasePrice || 0);
      const isBat = /batter|cell|mah/i.test(p.category?.name || '') ||
                    /batter|cell|mah/i.test(p.name || '') ||
                    p.partType === 'Battery';

      if (isBat) {
        batteriesStockPcs += qty;
        batteriesStockValue += val;
      } else {
        foldersStockPcs += qty;
        foldersStockValue += val;
      }
    });

    const totalStockPcs = foldersStockPcs + batteriesStockPcs;
    const totalStockValue = foldersStockValue + batteriesStockValue;

    // 4. Sorted Top Selling Products (Folders & Batteries)
    const topFolders = Object.values(folderProductsMap)
      .sort((a, b) => b.piecesSold - a.piecesSold || b.totalRevenue - a.totalRevenue);

    const topBatteries = Object.values(batteryProductsMap)
      .sort((a, b) => b.piecesSold - a.piecesSold || b.totalRevenue - a.totalRevenue);

    // Dynamic Category Sales Share for Pie / Donut
    const categorySales = [
      { name: 'Folders (Displays & Screens)', value: Math.round(foldersTotalSales), count: foldersPiecesSold, color: '#3b82f6' },
      { name: 'Batteries (Cells & Packs)', value: Math.round(batteriesTotalSales), count: batteriesPiecesSold, color: '#10b981' },
    ];

    const netProfit = Math.round(foldersTotalProfit + batteriesTotalProfit - totalExpensesAmount);
    const grossProfit = Math.round(foldersTotalProfit + batteriesTotalProfit);
    const overallMargin = totalSalesAmount > 0 ? Math.round((grossProfit / totalSalesAmount) * 100) : 0;

    res.json({
      location: activeLoc,
      locationId: locationId || 'ALL',
      locations: allLocations,
      timeRange: timeRange || 'ALL',
      intervalType,
      totalSalesAmount: Math.round(totalSalesAmount),
      prevSalesAmount: Math.round(prevSalesAmount),
      salesGrowthPct,
      grossProfit,
      netProfit,
      overallMargin,
      totalPurchaseAmount: Math.round(totalPurchaseAmount),
      moneyReceived: Math.round(moneyReceived),
      moneyPaid: Math.round(moneyPaid),
      totalExpensesAmount: Math.round(totalExpensesAmount),
      totalReceivables: Math.round(totalReceivables),
      totalPayables: Math.round(totalPayables),
      totalStockValue: Math.round(totalStockValue),
      totalStockPcs,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      cashSales: Math.round(cashSales),
      upiSales: Math.round(upiSales),
      creditDueSales: Math.round(creditDueSales),
      cashBalance,
      bankBalance,
      upiBalance,
      endingAmount,
      timelineData,
      categorySales,
      folders: {
        totalSales: Math.round(foldersTotalSales),
        piecesSold: foldersPiecesSold,
        billsCount: foldersBillsSet.size,
        profit: Math.round(foldersTotalProfit),
        marginPct: foldersTotalSales > 0 ? Math.round((foldersTotalProfit / foldersTotalSales) * 100) : 0,
        stockPcs: foldersStockPcs,
        stockValue: Math.round(foldersStockValue),
      },
      batteries: {
        totalSales: Math.round(batteriesTotalSales),
        piecesSold: batteriesPiecesSold,
        billsCount: batteriesBillsSet.size,
        profit: Math.round(batteriesTotalProfit),
        marginPct: batteriesTotalSales > 0 ? Math.round((batteriesTotalProfit / batteriesTotalSales) * 100) : 0,
        stockPcs: batteriesStockPcs,
        stockValue: Math.round(batteriesStockValue),
      },
      topFolders,
      topBatteries,
    });
  } catch (err) {
    console.error('Analytics Report Error:', err);
    res.status(500).json({ error: 'Failed to generate analytics report' });
  }
});

// ==========================================
// PROFIT & LOSS (P&L) ENGINE (ADMIN / OWNER EXCLUSIVE)
// ==========================================

// Helper: Resolve period date boundaries
function resolvePnlDateRange(period = 'monthly', startDateStr, endDateStr, yearVal) {
  const now = new Date();
  const currentYear = yearVal ? parseInt(yearVal, 10) : now.getFullYear();
  let start = new Date();
  let end = new Date();
  let periodLabel = 'This Month';

  const p = (period || 'monthly').toLowerCase();

  if (p === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    periodLabel = 'Today';
  } else if (p === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 3600000 + 59 * 60000 + 59000);
    periodLabel = 'This Week';
  } else if (p === 'monthly') {
    start = new Date(currentYear, now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
    periodLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  } else if (p === 'quarterly') {
    const m = now.getMonth();
    const q = Math.floor(m / 3);
    start = new Date(currentYear, q * 3, 1, 0, 0, 0, 0);
    end = new Date(currentYear, (q + 1) * 3, 0, 23, 59, 59, 999);
    periodLabel = `Q${q + 1} (${currentYear})`;
  } else if (p === 'q1') {
    start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 2, 31, 23, 59, 59, 999);
    periodLabel = `Q1 (Jan - Mar ${currentYear})`;
  } else if (p === 'q2') {
    start = new Date(currentYear, 3, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 5, 30, 23, 59, 59, 999);
    periodLabel = `Q2 (Apr - Jun ${currentYear})`;
  } else if (p === 'q3') {
    start = new Date(currentYear, 6, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 8, 30, 23, 59, 59, 999);
    periodLabel = `Q3 (Jul - Sep ${currentYear})`;
  } else if (p === 'q4') {
    start = new Date(currentYear, 9, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    periodLabel = `Q4 (Oct - Dec ${currentYear})`;
  } else if (p === 'half-yearly') {
    const isH2 = now.getMonth() >= 6;
    if (isH2) {
      start = new Date(currentYear, 6, 1, 0, 0, 0, 0);
      end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      periodLabel = `H2 (Jul - Dec ${currentYear})`;
    } else {
      start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      end = new Date(currentYear, 5, 30, 23, 59, 59, 999);
      periodLabel = `H1 (Jan - Jun ${currentYear})`;
    }
  } else if (p === 'h1') {
    start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 5, 30, 23, 59, 59, 999);
    periodLabel = `H1 (Jan - Jun ${currentYear})`;
  } else if (p === 'h2') {
    start = new Date(currentYear, 6, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    periodLabel = `H2 (Jul - Dec ${currentYear})`;

  } else if (p === 'yearly') {
    start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    periodLabel = `Year ${currentYear}`;
  } else if (p === 'custom' && startDateStr && endDateStr) {
    start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);
    periodLabel = `${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`;
  } else if (p === 'all') {
    start = new Date(2020, 0, 1);
    end = new Date(2035, 11, 31);
    periodLabel = 'All Time';
  }

  return { start, end, periodLabel, currentYear };
}

// 1. P&L FINANCIAL STATEMENT & SUMMARY (ADMIN ONLY)
router.get('/pnl/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { businessId, locationId, period = 'monthly', startDate, endDate, year } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const { start, end, periodLabel, currentYear } = resolvePnlDateRange(period, startDate, endDate, year);
    const isLocationSpecific = locationId && locationId !== 'ALL';

    const salesWhere = {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: start, lte: end },
      ...(isLocationSpecific ? { locationId } : {}),
    };

    const expensesWhere = {
      businessId,
      createdAt: { gte: start, lte: end },
      ...(isLocationSpecific ? { locationId } : {}),
    };

    // Fetch all sales and expenses for this period
    const [sales, expenses, locations, allProducts] = await Promise.all([
      prisma.sale.findMany({
        where: salesWhere,
        include: {
          items: {
            include: { product: true },
          },
          location: true,
          customer: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.expense.findMany({
        where: expensesWhere,
        orderBy: { date: 'asc' },
      }),
      prisma.location.findMany({
        where: { businessId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.product.findMany({
        where: { businessId },
        select: { id: true, name: true, purchasePrice: true, sellingPrice: true },
      }),
    ]);

    const productMap = new Map(allProducts.map(p => [p.id, p]));

    // Calculate Sales Revenue & COGS
    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalNetSales = 0;
    let totalCOGS = 0;
    let totalItemsSold = 0;

    sales.forEach(sale => {
      totalGrossSales += (sale.subtotal || 0);
      totalDiscount += (sale.discount || 0);
      totalNetSales += (sale.total || 0);

      sale.items.forEach(item => {
        const qty = item.quantity || 1;
        totalItemsSold += qty;
        const prod = item.product || (item.productId ? productMap.get(item.productId) : null);
        const costPrice = prod ? prod.purchasePrice : (item.unitPrice * 0.7);
        totalCOGS += qty * costPrice;
      });
    });

    const grossProfit = totalNetSales - totalCOGS;
    const grossMarginPercent = totalNetSales > 0 ? ((grossProfit / totalNetSales) * 100) : 0;

    // Categorized Operating Expenses
    const expenseCategories = {
      Rent: 0,
      Salary: 0,
      Electricity: 0,
      Packaging: 0,
      Transport: 0,
      Repair: 0,
      Marketing: 0,
      Office: 0,
      Other: 0,
    };

    let totalOperatingExpenses = 0;
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      if (expenseCategories[cat] !== undefined) {
        expenseCategories[cat] += e.amount;
      } else {
        expenseCategories.Other += e.amount;
      }
      totalOperatingExpenses += e.amount;
    });

    const netProfit = grossProfit - totalOperatingExpenses;
    const netProfitMarginPercent = totalNetSales > 0 ? ((netProfit / totalNetSales) * 100) : 0;

    // Timeline / Trend Data based on selected period
    // 12 Months of the current year for Yearly & Quarterly context
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyBreakdown = monthNames.map((name, idx) => ({
      month: name,
      monthIndex: idx,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
    }));

    // Populate all sales of current year into monthly breakdown
    const yearSales = await prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(currentYear, 0, 1, 0, 0, 0),
          lte: new Date(currentYear, 11, 31, 23, 59, 59),
        },
        ...(isLocationSpecific ? { locationId } : {}),
      },
      include: {
        items: { include: { product: true } },
      },
    });

    yearSales.forEach(s => {
      const d = new Date(s.createdAt);
      const mIdx = d.getMonth();
      const mData = monthlyBreakdown[mIdx];
      if (mData) {
        mData.revenue += (s.total || 0);
        let sCost = 0;
        s.items.forEach(i => {
          const prod = i.product || (i.productId ? productMap.get(i.productId) : null);
          const cp = prod ? prod.purchasePrice : (i.unitPrice * 0.7);
          sCost += (i.quantity || 1) * cp;
        });
        mData.cogs += sCost;
        mData.grossProfit += (s.total || 0) - sCost;
      }
    });

    const yearExpenses = await prisma.expense.findMany({
      where: {
        businessId,
        createdAt: {
          gte: new Date(currentYear, 0, 1, 0, 0, 0),
          lte: new Date(currentYear, 11, 31, 23, 59, 59),
        },
        ...(isLocationSpecific ? { locationId } : {}),
      },
    });

    yearExpenses.forEach(e => {
      const d = new Date(e.date || e.createdAt);
      const mIdx = d.getMonth();
      const mData = monthlyBreakdown[mIdx];
      if (mData) {
        mData.expenses += e.amount;
      }
    });

    monthlyBreakdown.forEach(m => {
      m.netProfit = m.grossProfit - m.expenses;
      m.revenue = Math.round(m.revenue);
      m.cogs = Math.round(m.cogs);
      m.grossProfit = Math.round(m.grossProfit);
      m.expenses = Math.round(m.expenses);
      m.netProfit = Math.round(m.netProfit);
    });

    // Quarterly Aggregations (Q1, Q2, Q3, Q4)
    const quarterlyBreakdown = [
      { quarter: 'Q1 (Jan - Mar)', revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, margin: 0 },
      { quarter: 'Q2 (Apr - Jun)', revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, margin: 0 },
      { quarter: 'Q3 (Jul - Sep)', revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, margin: 0 },
      { quarter: 'Q4 (Oct - Dec)', revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, margin: 0 },
    ];

    monthlyBreakdown.forEach((m, idx) => {
      const qIdx = Math.floor(idx / 3);
      quarterlyBreakdown[qIdx].revenue += m.revenue;
      quarterlyBreakdown[qIdx].cogs += m.cogs;
      quarterlyBreakdown[qIdx].grossProfit += m.grossProfit;
      quarterlyBreakdown[qIdx].expenses += m.expenses;
      quarterlyBreakdown[qIdx].netProfit += m.netProfit;
    });

    quarterlyBreakdown.forEach(q => {
      q.margin = q.revenue > 0 ? Number(((q.netProfit / q.revenue) * 100).toFixed(1)) : 0;
    });

    // Half-Yearly Aggregations (H1, H2)
    const halfYearlyBreakdown = [
      {
        halfYear: 'H1 (Jan - Jun)',
        revenue: quarterlyBreakdown[0].revenue + quarterlyBreakdown[1].revenue,
        cogs: quarterlyBreakdown[0].cogs + quarterlyBreakdown[1].cogs,
        grossProfit: quarterlyBreakdown[0].grossProfit + quarterlyBreakdown[1].grossProfit,
        expenses: quarterlyBreakdown[0].expenses + quarterlyBreakdown[1].expenses,
        netProfit: quarterlyBreakdown[0].netProfit + quarterlyBreakdown[1].netProfit,
        margin: 0,
      },
      {
        halfYear: 'H2 (Jul - Dec)',
        revenue: quarterlyBreakdown[2].revenue + quarterlyBreakdown[3].revenue,
        cogs: quarterlyBreakdown[2].cogs + quarterlyBreakdown[3].cogs,
        grossProfit: quarterlyBreakdown[2].grossProfit + quarterlyBreakdown[3].grossProfit,
        expenses: quarterlyBreakdown[2].expenses + quarterlyBreakdown[3].expenses,
        netProfit: quarterlyBreakdown[2].netProfit + quarterlyBreakdown[3].netProfit,
        margin: 0,
      },
    ];

    halfYearlyBreakdown.forEach(h => {
      h.margin = h.revenue > 0 ? Number(((h.netProfit / h.revenue) * 100).toFixed(1)) : 0;
    });

    // Store-wise P&L breakdown for consolidated view
    const storeBreakdown = [];
    for (const loc of locations) {
      const locSales = sales.filter(s => s.locationId === loc.id);
      const locExpenses = expenses.filter(e => e.locationId === loc.id);

      let locRev = 0;
      let locCost = 0;
      locSales.forEach(s => {
        locRev += (s.total || 0);
        s.items.forEach(i => {
          const prod = i.product || (i.productId ? productMap.get(i.productId) : null);
          const cp = prod ? prod.purchasePrice : (i.unitPrice * 0.7);
          locCost += (i.quantity || 1) * cp;
        });
      });

      const locExp = locExpenses.reduce((sum, e) => sum + e.amount, 0);
      const locGross = locRev - locCost;
      const locNet = locGross - locExp;

      storeBreakdown.push({
        locationId: loc.id,
        name: loc.name,
        type: loc.type,
        salesCount: locSales.length,
        revenue: Math.round(locRev),
        cogs: Math.round(locCost),
        grossProfit: Math.round(locGross),
        expenses: Math.round(locExp),
        netProfit: Math.round(locNet),
        margin: locRev > 0 ? Number(((locNet / locRev) * 100).toFixed(1)) : 0,
      });
    }

    res.json({
      period,
      periodLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      locationId: locationId || 'ALL',
      locations,
      totalGrossSales: Math.round(totalGrossSales),
      totalDiscount: Math.round(totalDiscount),
      totalNetSales: Math.round(totalNetSales),
      totalCOGS: Math.round(totalCOGS),
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
      totalOperatingExpenses: Math.round(totalOperatingExpenses),
      expenseCategories,
      netProfit: Math.round(netProfit),
      netProfitMarginPercent: Number(netProfitMarginPercent.toFixed(1)),
      invoicesCount: sales.length,
      itemsSoldCount: totalItemsSold,
      monthlyBreakdown,
      quarterlyBreakdown,
      halfYearlyBreakdown,
      storeBreakdown,
    });
  } catch (err) {
    console.error('P&L Summary Error:', err);
    res.status(500).json({ error: 'Failed to generate Profit & Loss summary' });
  }
});

// 2. PER-BILL PROFIT & LOSS (ADMIN ONLY)
router.get('/pnl/bills', authenticate, requireAdmin, async (req, res) => {
  try {
    const { businessId, locationId, period, startDate, endDate, search, page = 1, limit = 50 } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const { start, end } = resolvePnlDateRange(period, startDate, endDate);
    const isLocationSpecific = locationId && locationId !== 'ALL';

    const where = {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: start, lte: end },
      ...(isLocationSpecific ? { locationId } : {}),
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { billNo: { contains: q } },
        { customerName: { contains: q } },
      ];
    }

    const [totalCount, sales, allProducts] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          items: {
            include: { product: true },
          },
          location: true,
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
        take: parseInt(limit, 10),
      }),
      prisma.product.findMany({
        where: { businessId },
        select: { id: true, name: true, purchasePrice: true },
      }),
    ]);

    const productMap = new Map(allProducts.map(p => [p.id, p]));

    const billsProfitData = sales.map(sale => {
      let billCOGS = 0;
      const itemsDetailed = sale.items.map(item => {
        const qty = item.quantity || 1;
        const prod = item.product || (item.productId ? productMap.get(item.productId) : null);
        const purchaseCost = prod ? prod.purchasePrice : (item.unitPrice * 0.7);
        const lineTotal = item.total || (qty * item.unitPrice - (item.discount || 0));
        const lineCost = qty * purchaseCost;
        const lineProfit = lineTotal - lineCost;
        const lineMargin = lineTotal > 0 ? ((lineProfit / lineTotal) * 100) : 0;

        billCOGS += lineCost;

        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName || prod?.name || 'Spare Part Item',
          model: item.model,
          variant: item.variant,
          quality: item.quality,
          quantity: qty,
          unitPrice: item.unitPrice,
          purchasePrice: purchaseCost,
          lineTotal: Math.round(lineTotal),
          lineCost: Math.round(lineCost),
          lineProfit: Math.round(lineProfit),
          lineMargin: Number(lineMargin.toFixed(1)),
        };
      });

      const revenue = sale.total || 0;
      const grossProfit = revenue - billCOGS;
      const profitMargin = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;

      return {
        id: sale.id,
        billNo: sale.billNo,
        saleDate: sale.saleDate || sale.createdAt,
        customerName: sale.customerName || 'Walk-in Customer',
        customerPhone: sale.customerPhone,
        locationId: sale.locationId,
        locationName: sale.location?.name || 'Store',
        locationType: sale.location?.type || 'STORE',
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: revenue,
        cogs: Math.round(billCOGS),
        grossProfit: Math.round(grossProfit),
        profitMargin: Number(profitMargin.toFixed(1)),
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
        paymentMethod: sale.paymentMethod,
        itemsCount: sale.items.length,
        items: itemsDetailed,
      };
    });

    res.json({
      bills: billsProfitData,
      totalCount,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(totalCount / parseInt(limit, 10)),
    });
  } catch (err) {
    console.error('Per-Bill P&L Error:', err);
    res.status(500).json({ error: 'Failed to fetch Per-Bill Profit & Loss' });
  }
});

// 3. PER-CUSTOMER PROFIT & LOSS (ADMIN ONLY)
router.get('/pnl/customers', authenticate, requireAdmin, async (req, res) => {
  try {
    const { businessId, locationId, period, startDate, endDate } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const { start, end } = resolvePnlDateRange(period, startDate, endDate);
    const isLocationSpecific = locationId && locationId !== 'ALL';

    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
        ...(isLocationSpecific ? { locationId } : {}),
      },
      include: {
        customer: true,
        location: true,
        items: { include: { product: true } },
      },
    });

    const allProducts = await prisma.product.findMany({
      where: { businessId },
      select: { id: true, purchasePrice: true },
    });
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    const customerMap = new Map();

    sales.forEach(sale => {
      const cId = sale.customerId || `walkin_${sale.customerName || 'Walkin'}`;
      const cName = sale.customerName || 'Walk-in Customer';
      const cPhone = sale.customerPhone || '';
      const cLocName = sale.location?.name || 'Store';
      const moneyToRec = sale.customer?.moneyToReceive || 0;

      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          customerId: sale.customerId || null,
          customerName: cName,
          customerPhone: cPhone,
          locationName: cLocName,
          billsCount: 0,
          totalRevenue: 0,
          totalCOGS: 0,
          grossProfit: 0,
          profitMargin: 0,
          moneyToReceive: moneyToRec,
          lastBillDate: sale.createdAt,
          piecesBought: 0,
        });
      }

      const cData = customerMap.get(cId);
      cData.billsCount += 1;
      cData.totalRevenue += (sale.total || 0);

      let saleCost = 0;
      sale.items.forEach(i => {
        const prod = i.product || (i.productId ? productMap.get(i.productId) : null);
        const cp = prod ? prod.purchasePrice : (i.unitPrice * 0.7);
        saleCost += (i.quantity || 1) * cp;
        cData.piecesBought += (i.quantity || 1);
      });

      cData.totalCOGS += saleCost;
      if (new Date(sale.createdAt) > new Date(cData.lastBillDate)) {
        cData.lastBillDate = sale.createdAt;
      }
    });

    const customerList = Array.from(customerMap.values()).map(c => {
      const gProfit = c.totalRevenue - c.totalCOGS;
      const margin = c.totalRevenue > 0 ? ((gProfit / c.totalRevenue) * 100) : 0;
      return {
        ...c,
        totalRevenue: Math.round(c.totalRevenue),
        totalCOGS: Math.round(c.totalCOGS),
        grossProfit: Math.round(gProfit),
        profitMargin: Number(margin.toFixed(1)),
      };
    });

    // Sort by highest gross profit generated
    customerList.sort((a, b) => b.grossProfit - a.grossProfit);

    res.json(customerList);
  } catch (err) {
    console.error('Per-Customer P&L Error:', err);
    res.status(500).json({ error: 'Failed to fetch Per-Customer Profit & Loss' });
  }
});

// 4. PRODUCT & CATEGORY PROFITABILITY (ADMIN ONLY)
router.get('/pnl/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const { businessId, locationId, period, startDate, endDate } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const { start, end } = resolvePnlDateRange(period, startDate, endDate);
    const isLocationSpecific = locationId && locationId !== 'ALL';

    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
        ...(isLocationSpecific ? { locationId } : {}),
      },
      include: {
        items: {
          include: { product: { include: { category: true } } },
        },
      },
    });

    const productStats = new Map();
    const categoryStats = new Map();

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const prodName = item.productName || item.product?.name || 'Spare Part';
        const pId = item.productId || prodName;
        const catName = item.product?.category?.name || 'General Spares';
        const qty = item.quantity || 1;
        const rev = item.total || (qty * item.unitPrice - (item.discount || 0));
        const purchaseCost = item.product ? item.product.purchasePrice : (item.unitPrice * 0.7);
        const cost = qty * purchaseCost;
        const profit = rev - cost;

        // Product map
        if (!productStats.has(pId)) {
          productStats.set(pId, {
            productId: item.productId,
            name: prodName,
            category: catName,
            model: item.model || item.product?.model || '',
            quality: item.quality || item.product?.quality || 'OEM',
            quantitySold: 0,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            margin: 0,
          });
        }
        const pData = productStats.get(pId);
        pData.quantitySold += qty;
        pData.revenue += rev;
        pData.cogs += cost;
        pData.grossProfit += profit;

        // Category map
        if (!categoryStats.has(catName)) {
          categoryStats.set(catName, {
            name: catName,
            quantitySold: 0,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            margin: 0,
          });
        }
        const cData = categoryStats.get(catName);
        cData.quantitySold += qty;
        cData.revenue += rev;
        cData.cogs += cost;
        cData.grossProfit += profit;
      });
    });

    const products = Array.from(productStats.values()).map(p => ({
      ...p,
      revenue: Math.round(p.revenue),
      cogs: Math.round(p.cogs),
      grossProfit: Math.round(p.grossProfit),
      margin: p.revenue > 0 ? Number(((p.grossProfit / p.revenue) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.grossProfit - a.grossProfit);

    const categories = Array.from(categoryStats.values()).map(c => ({
      ...c,
      revenue: Math.round(c.revenue),
      cogs: Math.round(c.cogs),
      grossProfit: Math.round(c.grossProfit),
      margin: c.revenue > 0 ? Number(((c.grossProfit / c.revenue) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.grossProfit - a.grossProfit);

    res.json({
      products,
      categories,
    });
  } catch (err) {
    console.error('Product P&L Error:', err);
    res.status(500).json({ error: 'Failed to fetch Product & Category P&L' });
  }
});

// 5. EXPORT P&L TO EXCEL (ADMIN ONLY)
router.get('/pnl/export/excel', authenticate, requireAdmin, async (req, res) => {
  try {
    const { businessId, locationId, period = 'monthly', startDate, endDate } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const { start, end, periodLabel } = resolvePnlDateRange(period, startDate, endDate);
    const isLocationSpecific = locationId && locationId !== 'ALL';

    const [sales, expenses, business] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
          ...(isLocationSpecific ? { locationId } : {}),
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          location: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: {
          businessId,
          createdAt: { gte: start, lte: end },
          ...(isLocationSpecific ? { locationId } : {}),
        },
      }),
      prisma.business.findUnique({ where: { id: businessId } }),
    ]);

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Per-Bill Profitability
    const billRows = sales.map((s, idx) => {
      let billCost = 0;
      s.items.forEach(i => {
        const cp = i.product ? i.product.purchasePrice : (i.unitPrice * 0.7);
        billCost += (i.quantity || 1) * cp;
      });
      const rev = s.total || 0;
      const profit = rev - billCost;
      const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0.0';

      return {
        'S.No': idx + 1,
        'Bill No': s.billNo,
        'Date': new Date(s.saleDate || s.createdAt).toLocaleDateString('en-IN'),
        'Customer Name': s.customerName || 'Walk-in Customer',
        'Store / Branch': s.location?.name || 'Store',
        'Selling Revenue (₹)': Math.round(rev),
        'Cost of Goods (₹)': Math.round(billCost),
        'Gross Profit (₹)': Math.round(profit),
        'Margin %': `${margin}%`,
        'Payment Method': s.paymentMethod,
        'Paid Amount (₹)': s.paidAmount,
        'Balance Due (₹)': s.dueAmount,
      };
    });

    const billsSheet = XLSX.utils.json_to_sheet(billRows);
    XLSX.utils.book_append_sheet(workbook, billsSheet, 'Bills P&L');

    // Sheet 2: Financial Statement Summary
    let totalSales = 0;
    let totalCOGS = 0;
    sales.forEach(s => {
      totalSales += s.total || 0;
      s.items.forEach(i => {
        const cp = i.product ? i.product.purchasePrice : (i.unitPrice * 0.7);
        totalCOGS += (i.quantity || 1) * cp;
      });
    });

    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = totalSales - totalCOGS;
    const netProfit = grossProfit - totalExp;

    const summaryRows = [
      { Metric: 'Business Name', Value: business?.name || 'BIRD ERP' },
      { Metric: 'Period', Value: periodLabel },
      { Metric: 'Total Invoices Issued', Value: sales.length },
      { Metric: 'Gross Sales Revenue (₹)', Value: Math.round(totalSales) },
      { Metric: 'Cost of Goods Sold (COGS) (₹)', Value: Math.round(totalCOGS) },
      { Metric: 'Gross Profit (₹)', Value: Math.round(grossProfit) },
      { Metric: 'Gross Margin %', Value: totalSales > 0 ? `${((grossProfit / totalSales) * 100).toFixed(1)}%` : '0%' },
      { Metric: 'Total Operating Expenses (₹)', Value: Math.round(totalExp) },
      { Metric: 'Net Profit (₹)', Value: Math.round(netProfit) },
      { Metric: 'Net Profit Margin %', Value: totalSales > 0 ? `${((netProfit / totalSales) * 100).toFixed(1)}%` : '0%' },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=BIRD_PnL_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('P&L Export Error:', err);
    res.status(500).json({ error: 'Failed to export P&L report' });
  }
});

export default router;

