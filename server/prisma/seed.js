import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { StockEngine } from '../src/services/StockEngine.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BIRD Database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('bird123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'owner@birdparts.com' },
    update: {},
    create: {
      name: 'Bird Admin Owner',
      email: 'owner@birdparts.com',
      password: hashedPassword,
      role: 'OWNER',
    },
  });

  // Create primary business (MI2 Impex)
  const business1 = await prisma.business.create({
    data: {
      name: 'MI2 Impex',
      address: 'Shop 14, Karol Bagh Mobile Spare Market, New Delhi - 110005',
      phone: '+91 98765 43210',
      email: 'sales@mi2impex.com',
      gstin: '07AAAAA0000A1Z5',
      state: 'Delhi',
      billPrefix: 'MI2',
      startingBillNo: 1001,
      bankName: 'HDFC Bank',
      accountNo: '50200012345678',
      ifscCode: 'HDFC0000123',
      upiId: 'mi2impex@hdfcbank',
      terms: '1. Testing warranty 7 days on displays & batteries before installation.\n2. No warranty on physical or flex damage.',
      users: {
        create: {
          userId: user.id,
        },
      },
    },
  });

  // Account balances for primary business
  await prisma.accountBalance.create({
    data: {
      businessId: business1.id,
      cashBalance: 45000.0,
      bankBalance: 185000.0,
      upiBalance: 62400.0,
    },
  });

  // Categories (Folders and Batteries)
  const categoriesData = [
    { name: 'Folders', description: 'Folder assemblies, screens, LCDs & OLED displays' },
    { name: 'Batteries', description: 'Original, OEM, high-capacity replacement batteries' },
  ];

  const categories = [];
  for (const cat of categoriesData) {
    const created = await prisma.category.create({
      data: {
        businessId: business1.id,
        name: cat.name,
        description: cat.description,
      },
    });
    categories.push(created);
  }

  // Sample Products for Bird Mobile Parts
  const productsData = [
    {
      name: 'Samsung A15 Display',
      brand: 'Samsung',
      model: 'Galaxy A15 5G',
      partType: 'Display',
      variant: 'With Frame / Black',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'DISP-SAM-A15',
      sku: 'SAM-A15-DISP',
      aliases: 'A15 LCD, Samsung A15 LCD, A15 Screen, A15 Display, A15 INCELL, Samsung A15 Folder',
      barcode: '890123456701',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 1850.0,
      sellingPrice: 2400.0,
      mrp: 2999.0,
      currentStock: 120,
      goodStock: 120,
      defectiveStock: 0,
      testingStock: 0,
      minStock: 15,
      warranty: '7 Days Testing Warranty',
      categoryId: categories[0].id,
    },
    {
      name: 'Redmi Note 10 Folder',
      brand: 'Xiaomi / Redmi',
      model: 'Note 10 4G',
      partType: 'Folder',
      variant: 'Black Frame',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'FOLD-RED-N10',
      sku: 'RED-N10-FOLD',
      aliases: 'Redmi Note 10 LCD, Note 10 Folder, Redmi Note 10 Screen, Note 10 Display',
      barcode: '890123456702',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 1200.0,
      sellingPrice: 1650.0,
      mrp: 2200.0,
      currentStock: 80,
      goodStock: 80,
      minStock: 10,
      warranty: '7 Days Testing Warranty',
      categoryId: categories[1].id,
    },
    {
      name: 'Vivo Y21 Folder',
      brand: 'Vivo',
      model: 'Y21 / Y21s',
      partType: 'Folder',
      variant: 'Black Frame',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'FOLD-VIV-Y21',
      sku: 'VIV-Y21-FOLD',
      aliases: 'Vivo Y21 LCD, Y21 Folder, Vivo Y21 Display, Y21 Screen',
      barcode: '890123456703',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 950.0,
      sellingPrice: 1350.0,
      mrp: 1800.0,
      currentStock: 45,
      goodStock: 45,
      minStock: 10,
      warranty: '7 Days Testing',
      categoryId: categories[1].id,
    },
    {
      name: 'Samsung A15 Battery',
      brand: 'Samsung',
      model: 'Galaxy A15',
      partType: 'Battery',
      variant: '5000 mAh',
      quality: 'Original',
      unit: 'PCS',
      itemCode: 'BAT-SAM-A15',
      sku: 'SAM-A15-BAT',
      aliases: 'A15 Battery, Samsung A15 Batt, A15 Cell, Samsung A15 5000mAh',
      barcode: '890123456704',
      hsn: '8507',
      gstPercentage: 18.0,
      purchasePrice: 450.0,
      sellingPrice: 750.0,
      mrp: 999.0,
      currentStock: 85,
      goodStock: 85,
      minStock: 15,
      warranty: '6 Months Warranty',
      categoryId: categories[2].id,
    },
    {
      name: 'Redmi Note 10 Battery',
      brand: 'Xiaomi / Redmi',
      model: 'Note 10 4G',
      partType: 'Battery',
      variant: '5000 mAh BN59',
      quality: 'Original',
      unit: 'PCS',
      itemCode: 'BAT-RED-N10',
      sku: 'RED-N10-BAT',
      aliases: 'Note 10 Battery, Redmi Note 10 Batt, BN59 Battery, BN59',
      barcode: '890123456705',
      hsn: '8507',
      gstPercentage: 18.0,
      purchasePrice: 420.0,
      sellingPrice: 700.0,
      mrp: 950.0,
      currentStock: 40,
      goodStock: 40,
      minStock: 10,
      warranty: '6 Months Warranty',
      categoryId: categories[2].id,
    },
    {
      name: 'iPhone 11 Battery',
      brand: 'Apple',
      model: 'iPhone 11',
      partType: 'Battery',
      variant: '3110 mAh',
      quality: 'Original',
      unit: 'PCS',
      itemCode: 'BAT-IP11',
      sku: 'IP11-BAT',
      aliases: 'IP11 Battery, iPhone 11 Batt, IP11 Cell, iPhone 11 Battery Replacement',
      barcode: '890123456706',
      hsn: '8507',
      gstPercentage: 18.0,
      purchasePrice: 650.0,
      sellingPrice: 1100.0,
      mrp: 1499.0,
      currentStock: 25,
      goodStock: 25,
      minStock: 5,
      warranty: '6 Months Warranty',
      categoryId: categories[2].id,
    },
    {
      name: 'Redmi Note 10 Charging Sub-Board',
      brand: 'Xiaomi / Redmi',
      model: 'Note 10 4G',
      partType: 'Charging Port',
      variant: 'CC Sub Board IC Type',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'CC-RED-N10',
      barcode: '890123456704',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 120.0,
      sellingPrice: 250.0,
      mrp: 399.0,
      currentStock: 45,
      goodStock: 45,
      minStock: 10,
      warranty: '7 Days Testing',
      categoryId: categories[3].id,
    },
    {
      name: 'Vivo Y20 Folder Assembly',
      brand: 'Vivo',
      model: 'Y20 / Y20i / Y20s',
      partType: 'Display',
      variant: 'Black Frame',
      quality: 'Compatible',
      unit: 'PCS',
      itemCode: 'DISP-VIV-Y20',
      barcode: '890123456705',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 980.0,
      sellingPrice: 1350.0,
      mrp: 1800.0,
      currentStock: 4,
      goodStock: 4,
      minStock: 10, // Low Stock Trigger!
      warranty: '7 Days Testing',
      categoryId: categories[0].id,
    },
    {
      name: 'OnePlus 9 Pro Back Glass Housing',
      brand: 'OnePlus',
      model: '9 Pro',
      partType: 'Folder / Housing',
      variant: 'Pine Green',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'HOUS-OP9P-GRN',
      barcode: '890123456706',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 650.0,
      sellingPrice: 1100.0,
      mrp: 1500.0,
      currentStock: 8,
      goodStock: 8,
      minStock: 2,
      warranty: 'No Warranty',
      categoryId: categories[1].id,
    },
    {
      name: 'PM6150 Power IC Chip',
      brand: 'Qualcomm',
      model: 'Universal PM6150',
      partType: 'ICs & Chips',
      variant: 'BGA Chip',
      quality: 'Original',
      unit: 'PCS',
      itemCode: 'IC-PM6150',
      barcode: '890123456707',
      hsn: '8542',
      gstPercentage: 18.0,
      purchasePrice: 180.0,
      sellingPrice: 320.0,
      mrp: 499.0,
      currentStock: 30,
      goodStock: 30,
      minStock: 5,
      warranty: 'Testing Warranty',
      categoryId: categories[5].id,
    },
  ];

  for (const prod of productsData) {
    const product = await prisma.product.create({
      data: {
        businessId: business1.id,
        ...prod,
      },
    });

    // Opening stock movement
    await prisma.stockMovement.create({
      data: {
        businessId: business1.id,
        productId: product.id,
        type: 'OPENING',
        quantity: product.currentStock,
        previousStock: 0,
        newStock: product.currentStock,
        stockState: 'GOOD',
        reference: 'INITIAL_STOCK',
        note: 'Opening inventory stock initialization',
      },
    });
  }

  // Ensure default locations exist (Godown, Store 1, Store 2)
  const locations = await StockEngine.ensureDefaultLocations(business1.id, prisma);
  const godown = locations.find((l) => l.type === 'GODOWN') || locations[0];
  const store1 = locations.find((l) => l.name === 'Store 1') || locations[1];
  const store2 = locations.find((l) => l.name === 'Store 2') || locations[2];

  // Customers for Store 1
  const customer1 = await prisma.customer.create({
    data: {
      businessId: business1.id,
      locationId: store1.id,
      name: 'Mobile Care Repair Hub',
      phone: '+91 98112 34567',
      email: 'mobilecare@gmail.com',
      address: 'Shop 4, Main Market, Laxmi Nagar, Delhi',
      gstin: '07BCDE1234F1Z9',
      state: 'Delhi',
      moneyToReceive: 42500.0,
      totalSales: 215000.0,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      businessId: business1.id,
      locationId: store1.id,
      name: 'Rahul Mobile Solutions',
      phone: '+91 98991 12233',
      email: 'rahulmobile@yahoo.com',
      address: 'Metro Pillar 42, Rohini Sector 7, Delhi',
      state: 'Delhi',
      moneyToReceive: 18200.0,
      totalSales: 94000.0,
    },
  });

  // Customer for Store 2 (Separate store-specific account)
  const customerStore2 = await prisma.customer.create({
    data: {
      businessId: business1.id,
      locationId: store2.id,
      name: 'Rahul Mobile Solutions',
      phone: '+91 98991 12233',
      email: 'rahulmobile.store2@yahoo.com',
      address: 'Shop 12, Pitampura Market, Delhi',
      state: 'Delhi',
      moneyToReceive: 8000.0,
      totalSales: 25000.0,
    },
  });

  // Customer Ledgers
  await prisma.customerLedger.create({
    data: {
      businessId: business1.id,
      locationId: store1.id,
      customerId: customer1.id,
      type: 'BILL',
      reference: 'BIRD-1001',
      amount: 42500.0,
      balanceAfter: 42500.0,
      note: 'Bill BIRD-1001 for Display and Batteries',
    },
  });

  await prisma.customerLedger.create({
    data: {
      businessId: business1.id,
      locationId: store2.id,
      customerId: customerStore2.id,
      type: 'BILL',
      reference: 'S2-1001',
      amount: 8000.0,
      balanceAfter: 8000.0,
      note: 'Bill S2-1001 for Testing Stock',
    },
  });

  // Suppliers for Store 1
  const supplier1 = await prisma.supplier.create({
    data: {
      businessId: business1.id,
      locationId: store1.id,
      name: 'ABC Mobile Parts Wholesale',
      phone: '+91 99100 88776',
      email: 'abctraders@gmail.com',
      address: 'Gaffar Market, Karol Bagh, Delhi',
      gstin: '07XYZAB9999C1Z2',
      state: 'Delhi',
      moneyToPay: 64200.0,
      totalPurchases: 480000.0,
    },
  });

  // Supplier for Store 2
  const supplierStore2 = await prisma.supplier.create({
    data: {
      businessId: business1.id,
      locationId: store2.id,
      name: 'ABC Mobile Parts Wholesale',
      phone: '+91 99100 88776',
      email: 'abctraders.store2@gmail.com',
      address: 'Gaffar Market, Karol Bagh, Delhi',
      gstin: '07XYZAB9999C1Z2',
      state: 'Delhi',
      moneyToPay: 5000.0,
      totalPurchases: 50000.0,
    },
  });

  await prisma.supplierLedger.create({
    data: {
      businessId: business1.id,
      locationId: store1.id,
      supplierId: supplier1.id,
      type: 'PURCHASE',
      reference: 'PUR-501',
      amount: 64200.0,
      balanceAfter: 64200.0,
      note: 'Purchase PUR-501 Displays Stock Batch',
    },
  });

  await prisma.supplierLedger.create({
    data: {
      businessId: business1.id,
      locationId: store2.id,
      supplierId: supplierStore2.id,
      type: 'PURCHASE',
      reference: 'S2-PUR-101',
      amount: 5000.0,
      balanceAfter: 5000.0,
      note: 'Purchase S2-PUR-101 Small Parts',
    },
  });

  // Sample Stock Order for Godown Procurement
  await prisma.purchaseOrder.create({
    data: {
      businessId: business1.id,
      locationId: godown.id,
      poNo: 'PO-8821',
      supplierId: supplier1.id,
      supplierName: 'ABC Mobile Parts Wholesale',
      poDate: new Date(),
      expectedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      subtotal: 67500.0,
      total: 67500.0,
      status: 'ORDERED',
      notes: 'Godown procurement batch',
      items: {
        create: [
          {
            productName: 'Samsung A15 Display',
            quantity: 50,
            receivedQuantity: 0,
            unitPrice: 1850.0,
            total: 92500.0,
          },
          {
            productName: 'Samsung A15 Battery',
            quantity: 100,
            receivedQuantity: 0,
            unitPrice: 450.0,
            total: 45000.0,
          },
        ],
      },
    },
  });

  console.log('✅ BIRD Database successfully seeded with Store 1, Store 2, and Godown isolated data!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
