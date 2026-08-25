import { PrismaClient } from '@prisma/client';
import { StockEngine } from '../src/services/StockEngine.js';

const prisma = new PrismaClient();

async function runCommonInventoryTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING COMMON INVENTORY SPECIFICATION TESTS');
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
    const business = await prisma.business.create({
      data: {
        name: 'Common Inventory Test Business ' + Date.now(),
        allowNegativeStock: true,
      },
    });

    const locations = await StockEngine.ensureDefaultLocations(business.id, prisma);
    const godown = locations.find(l => l.type === 'GODOWN');
    const store1 = locations.find(l => l.name === 'Store 1');
    const store2 = locations.find(l => l.name === 'Store 2');

    assert(godown && store1 && store2, 'Default Godown, Store 1, and Store 2 exist');

    // 1. Create a Folder Product with Initial Stock = 50
    const folderProduct = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Display Samsung A15 Crown',
        model: 'A15',
        brand: 'Samsung',
        partType: 'Folder / Display',
        purchasePrice: 400,
        sellingPrice: 600,
        currentStock: 0,
      },
    });

    await StockEngine.recordMovement({
      businessId: business.id,
      productId: folderProduct.id,
      locationId: godown.id,
      type: 'OPENING',
      quantity: 50,
      stockState: 'GOOD',
      reference: 'INIT-1',
    });

    // Check stock in Godown, Store 1, Store 2
    let gStock = await StockEngine.getLocationStock(business.id, godown.id, folderProduct.id);
    let s1Stock = await StockEngine.getLocationStock(business.id, store1.id, folderProduct.id);
    let s2Stock = await StockEngine.getLocationStock(business.id, store2.id, folderProduct.id);

    assert(
      gStock.quantity === 50 && s1Stock.quantity === 50 && s2Stock.quantity === 50,
      'TEST 1: New Folder stock of 50 appears identically in Godown, Store 1, and Store 2'
    );

    // 2. Create a Battery Product with Initial Stock = 30
    const batteryProduct = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Battery BLP-793 Oppo A15',
        model: 'BLP-793',
        brand: 'Oppo',
        partType: 'Battery',
        purchasePrice: 200,
        sellingPrice: 350,
        currentStock: 0,
      },
    });

    await StockEngine.recordMovement({
      businessId: business.id,
      productId: batteryProduct.id,
      locationId: store1.id,
      type: 'OPENING',
      quantity: 30,
      stockState: 'GOOD',
      reference: 'INIT-2',
    });

    gStock = await StockEngine.getLocationStock(business.id, godown.id, batteryProduct.id);
    s1Stock = await StockEngine.getLocationStock(business.id, store1.id, batteryProduct.id);
    s2Stock = await StockEngine.getLocationStock(business.id, store2.id, batteryProduct.id);

    assert(
      gStock.quantity === 30 && s1Stock.quantity === 30 && s2Stock.quantity === 30,
      'TEST 2: New Battery stock of 30 added at Store 1 appears identically in Godown, Store 1, and Store 2'
    );

    // 3. Bill created at Store 1 for 3 Folders: Stock becomes 47 everywhere
    await StockEngine.recordMovement({
      businessId: business.id,
      productId: folderProduct.id,
      locationId: store1.id,
      type: 'SALE',
      quantity: -3,
      stockState: 'GOOD',
      reference: 'BILL-101',
    });

    gStock = await StockEngine.getLocationStock(business.id, godown.id, folderProduct.id);
    s1Stock = await StockEngine.getLocationStock(business.id, store1.id, folderProduct.id);
    s2Stock = await StockEngine.getLocationStock(business.id, store2.id, folderProduct.id);
    let prod = await prisma.product.findUnique({ where: { id: folderProduct.id } });

    assert(
      prod.currentStock === 47 && gStock.quantity === 47 && s1Stock.quantity === 47 && s2Stock.quantity === 47,
      'TEST 3: Folder Sale of 3 pcs at Store 1 immediately updates stock to 47 in Godown, Store 1, Store 2, and Product'
    );

    // 4. Bill created at Store 2 for 5 Batteries: Stock becomes 25 everywhere
    await StockEngine.recordMovement({
      businessId: business.id,
      productId: batteryProduct.id,
      locationId: store2.id,
      type: 'SALE',
      quantity: -5,
      stockState: 'GOOD',
      reference: 'BILL-102',
    });

    gStock = await StockEngine.getLocationStock(business.id, godown.id, batteryProduct.id);
    s1Stock = await StockEngine.getLocationStock(business.id, store1.id, batteryProduct.id);
    s2Stock = await StockEngine.getLocationStock(business.id, store2.id, batteryProduct.id);
    prod = await prisma.product.findUnique({ where: { id: batteryProduct.id } });

    assert(
      prod.currentStock === 25 && gStock.quantity === 25 && s1Stock.quantity === 25 && s2Stock.quantity === 25,
      'TEST 4: Battery Sale of 5 pcs at Store 2 immediately updates stock to 25 in Godown, Store 1, Store 2, and Product'
    );

    // 5. New Stock added (+20 Folders) via Purchase/Adjustment: Stock becomes 67 everywhere
    await StockEngine.recordMovement({
      businessId: business.id,
      productId: folderProduct.id,
      locationId: godown.id,
      type: 'PURCHASE',
      quantity: 20,
      stockState: 'GOOD',
      reference: 'PUR-201',
    });

    gStock = await StockEngine.getLocationStock(business.id, godown.id, folderProduct.id);
    s1Stock = await StockEngine.getLocationStock(business.id, store1.id, folderProduct.id);
    s2Stock = await StockEngine.getLocationStock(business.id, store2.id, folderProduct.id);
    prod = await prisma.product.findUnique({ where: { id: folderProduct.id } });

    assert(
      prod.currentStock === 67 && gStock.quantity === 67 && s1Stock.quantity === 67 && s2Stock.quantity === 67,
      'TEST 5: New stock purchase (+20 Folders) immediately updates stock to 67 in Godown, Store 1, and Store 2'
    );

    // Clean up test data
    await prisma.stockMovement.deleteMany({ where: { businessId: business.id } });
    await prisma.locationStock.deleteMany({ where: { businessId: business.id } });
    await prisma.product.deleteMany({ where: { businessId: business.id } });
    await prisma.location.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });

    console.log(`\n========================================================`);
    console.log(`🎉 ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCommonInventoryTests();
