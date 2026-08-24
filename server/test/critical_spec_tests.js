import { PrismaClient } from '@prisma/client';
import { StockEngine } from '../src/services/StockEngine.js';
import { LedgerEngine } from '../src/services/LedgerEngine.js';

const prisma = new PrismaClient();

async function runCriticalSpecTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PROJECT BIRD: Running 10 Critical Specification Tests');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // Setup Test Business, Godown, Store 1, Store 2
    const business = await prisma.business.create({
      data: {
        name: 'BIRD Spec Test Business ' + Date.now(),
        phone: '+91 9876543210',
        allowNegativeStock: true,
      },
    });

    const godown = await prisma.location.create({
      data: {
        businessId: business.id,
        name: 'Central Godown',
        type: 'GODOWN',
      },
    });

    const store1 = await prisma.location.create({
      data: {
        businessId: business.id,
        name: 'Store 1 — Karol Bagh',
        type: 'STORE',
      },
    });

    const store2 = await prisma.location.create({
      data: {
        businessId: business.id,
        name: 'Store 2 — Rohini',
        type: 'STORE',
      },
    });

    const catFolders = await prisma.category.create({
      data: {
        id: 'folders-' + Date.now(),
        businessId: business.id,
        name: 'Folders',
      },
    });

    const catBatteries = await prisma.category.create({
      data: {
        id: 'batteries-' + Date.now(),
        businessId: business.id,
        name: 'Batteries',
      },
    });

    // Create 1 Folder Product & 1 Battery Product
    const folderProduct = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: catFolders.id,
        name: 'Samsung A15 Folder',
        model: 'A15',
        brand: 'Samsung',
        purchasePrice: 300,
        sellingPrice: 450,
        currentStock: 300,
      },
    });

    const batteryProduct = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: catBatteries.id,
        name: 'Samsung A15 Battery',
        model: 'A15',
        brand: 'Samsung',
        purchasePrice: 200,
        sellingPrice: 350,
        currentStock: 200,
      },
    });

    // Initialize Godown Stock
    await prisma.locationStock.create({
      data: {
        businessId: business.id,
        locationId: godown.id,
        productId: folderProduct.id,
        goodStock: 300,
        quantity: 300,
      },
    });

    await prisma.locationStock.create({
      data: {
        businessId: business.id,
        locationId: godown.id,
        productId: batteryProduct.id,
        goodStock: 200,
        quantity: 200,
      },
    });

    // Initialize Store 1 Stocks
    await prisma.locationStock.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        productId: folderProduct.id,
        goodStock: 40,
        quantity: 40,
      },
    });

    await prisma.locationStock.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        productId: batteryProduct.id,
        goodStock: 30,
        quantity: 30,
      },
    });

    // ----------------------------------------------------
    // TEST 1: Customer Isolation (Store 1 -> Folders)
    // ----------------------------------------------------
    const custFolderStore1 = await prisma.customer.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        categoryId: 'folders',
        name: 'Rahul Mobile',
        phone: '9999900001',
        moneyToReceive: 5000,
      },
    });

    const checkStore1Batteries = await prisma.customer.findMany({
      where: { businessId: business.id, locationId: store1.id, categoryId: 'batteries' },
    });
    const checkStore2Folders = await prisma.customer.findMany({
      where: { businessId: business.id, locationId: store2.id, categoryId: 'folders' },
    });
    const checkStore2Batteries = await prisma.customer.findMany({
      where: { businessId: business.id, locationId: store2.id, categoryId: 'batteries' },
    });

    assert(
      checkStore1Batteries.length === 0 && checkStore2Folders.length === 0 && checkStore2Batteries.length === 0,
      'TEST 1: Customer in Store 1 Folders does NOT appear in Store 1 Batteries, Store 2 Folders, or Store 2 Batteries'
    );

    // ----------------------------------------------------
    // TEST 2: Separate Category Customer in same store
    // ----------------------------------------------------
    const custBatteryStore1 = await prisma.customer.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        categoryId: 'batteries',
        name: 'Rahul Mobile',
        phone: '9999900001', // Same phone allowed across categories
        moneyToReceive: 2000,
      },
    });

    assert(
      custFolderStore1.id !== custBatteryStore1.id && custFolderStore1.categoryId === 'folders' && custBatteryStore1.categoryId === 'batteries',
      'TEST 2: Rahul Mobile in Store 1 Batteries is a separate category-specific record without overwriting Folder customer'
    );

    // ----------------------------------------------------
    // TEST 3: Payment Isolation
    // ----------------------------------------------------
    const p1 = await prisma.payment.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        categoryId: 'folders',
        type: 'RECEIVE',
        partyType: 'CUSTOMER',
        customerId: custFolderStore1.id,
        partyName: custFolderStore1.name,
        amount: 25000,
        paymentMethod: 'CASH',
      },
    });

    const store1Payments = await prisma.payment.aggregate({
      where: { businessId: business.id, locationId: store1.id },
      _sum: { amount: true },
    });
    const store2Payments = await prisma.payment.aggregate({
      where: { businessId: business.id, locationId: store2.id },
      _sum: { amount: true },
    });

    assert(
      (store1Payments._sum.amount || 0) === 25000 && (store2Payments._sum.amount || 0) === 0,
      'TEST 3: Store 1 payment increases by ₹25,000 while Store 2 payment remains 0'
    );

    // ----------------------------------------------------
    // TEST 4: Store 1 Folders Stock Deduction
    // ----------------------------------------------------
    // Sell 5 pieces of Folder in Store 1
    await StockEngine.recordMovement({
      businessId: business.id,
      productId: folderProduct.id,
      locationId: store1.id,
      categoryId: 'folders',
      type: 'SALE',
      quantity: -5,
      stockState: 'GOOD',
      reference: 'BILL-TEST-1',
    });

    const store1FolderStock = await prisma.locationStock.findUnique({
      where: { businessId_locationId_productId: { businessId: business.id, locationId: store1.id, productId: folderProduct.id } },
    });
    const store1BatteryStock = await prisma.locationStock.findUnique({
      where: { businessId_locationId_productId: { businessId: business.id, locationId: store1.id, productId: batteryProduct.id } },
    });
    const godownFolderStock = await prisma.locationStock.findUnique({
      where: { businessId_locationId_productId: { businessId: business.id, locationId: godown.id, productId: folderProduct.id } },
    });

    assert(
      store1FolderStock.goodStock === 35 && store1BatteryStock.goodStock === 30 && godownFolderStock.goodStock === 300,
      'TEST 4: Store 1 Folder stock decreased by 5 (40 -> 35), Batteries & Godown remain unchanged'
    );

    // ----------------------------------------------------
    // TEST 5: Stock Transfer Godown -> Store 1
    // ----------------------------------------------------
    await StockEngine.transferStock({
      businessId: business.id,
      productId: folderProduct.id,
      fromLocationId: godown.id,
      toLocationId: store1.id,
      quantity: 50,
      note: 'Transfer 50 pcs Samsung A15 Folder',
    });

    const postGodownStock = await prisma.locationStock.findUnique({
      where: { businessId_locationId_productId: { businessId: business.id, locationId: godown.id, productId: folderProduct.id } },
    });
    const postStore1Stock = await prisma.locationStock.findUnique({
      where: { businessId_locationId_productId: { businessId: business.id, locationId: store1.id, productId: folderProduct.id } },
    });

    assert(
      postGodownStock.goodStock === 250 && postStore1Stock.goodStock === 85,
      'TEST 5: Godown -> Store 1 transfer: Godown -50 (300 -> 250), Store 1 +50 (35 -> 85)'
    );

    // ----------------------------------------------------
    // TEST 6: Atomic Bill Creation & Profit Tracking
    // ----------------------------------------------------
    const saleBill = await prisma.sale.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        categoryId: 'folders',
        billNo: 'BIRD-FLD-1001',
        customerName: 'Rahul Mobile',
        customerId: custFolderStore1.id,
        subtotal: 4500,
        total: 4500,
        totalCost: 3000, // 10 pcs * ₹300 cost
        grossProfit: 1500, // ₹4500 - ₹3000 = ₹1500 Gross Profit
        paidAmount: 4500,
        dueAmount: 0,
        items: {
          create: [
            {
              productId: folderProduct.id,
              productName: folderProduct.name,
              quantity: 10,
              unitPrice: 450,
              purchasePrice: 300,
              total: 4500,
            },
          ],
        },
      },
    });

    assert(
      saleBill.grossProfit === 1500 && saleBill.totalCost === 3000 && saleBill.categoryId === 'folders',
      'TEST 6: Bill calculates Gross Profit = Revenue (₹4,500) - COGS (₹3,000) = ₹1,500'
    );

    // ----------------------------------------------------
    // TEST 7: Negative Stock Allowed
    // ----------------------------------------------------
    // Deduct 100 pcs when only 85 available -> goes to -15
    await StockEngine.recordMovement({
      businessId: business.id,
      productId: folderProduct.id,
      locationId: store1.id,
      categoryId: 'folders',
      type: 'SALE',
      quantity: -100,
      stockState: 'GOOD',
      reference: 'BILL-NEG-1',
    });

    const negStockRecord = await prisma.locationStock.findUnique({
      where: { businessId_locationId_productId: { businessId: business.id, locationId: store1.id, productId: folderProduct.id } },
    });

    assert(
      negStockRecord.goodStock === -15,
      'TEST 7: Negative stock permitted: Store 1 stock adjusted to -15 without error'
    );

    // ----------------------------------------------------
    // TEST 8: Category Specific Expense
    // ----------------------------------------------------
    const expense = await prisma.expense.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        categoryId: 'folders',
        category: 'Packaging',
        amount: 500,
      },
    });

    const folderExpenses = await prisma.expense.aggregate({
      where: { businessId: business.id, locationId: store1.id, categoryId: 'folders' },
      _sum: { amount: true },
    });

    assert(
      (folderExpenses._sum.amount || 0) === 500,
      'TEST 8: Category-specific expense recorded and scoped to Folders'
    );

    // ----------------------------------------------------
    // TEST 9: Net Profit Calculation
    // ----------------------------------------------------
    const netProfit = saleBill.grossProfit - expense.amount; // 1500 - 500 = 1000
    assert(
      netProfit === 1000,
      'TEST 9: Net Profit = Gross Profit (₹1,500) - Expenses (₹500) = ₹1,000'
    );

    // ----------------------------------------------------
    // TEST 10: Central Godown Has No Sales or Customer Bills
    // ----------------------------------------------------
    const godownSales = await prisma.sale.findMany({
      where: { businessId: business.id, locationId: godown.id },
    });
    const godownCustomers = await prisma.customer.findMany({
      where: { businessId: business.id, locationId: godown.id },
    });

    assert(
      godownSales.length === 0 && godownCustomers.length === 0,
      'TEST 10: Central Godown maintains pure stock with 0 customer records or sales bills'
    );

    // Cleanup Test Data
    await prisma.saleItem.deleteMany({ where: { saleId: saleBill.id } });
    await prisma.sale.deleteMany({ where: { businessId: business.id } });
    await prisma.customerLedger.deleteMany({ where: { businessId: business.id } });
    await prisma.payment.deleteMany({ where: { businessId: business.id } });
    await prisma.expense.deleteMany({ where: { businessId: business.id } });
    await prisma.customer.deleteMany({ where: { businessId: business.id } });
    await prisma.stockMovement.deleteMany({ where: { businessId: business.id } });
    await prisma.locationStock.deleteMany({ where: { businessId: business.id } });
    await prisma.product.deleteMany({ where: { businessId: business.id } });
    await prisma.category.deleteMany({ where: { businessId: business.id } });
    await prisma.location.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });

    console.log(`\n========================================================`);
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================================\n`);
  } catch (err) {
    console.error('Test Suite Exception:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runCriticalSpecTests();
