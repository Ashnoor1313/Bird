import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { StockEngine } from '../src/services/StockEngine.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BIRD Database with Master Catalog & Store Isolation...');

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

  // Create or retrieve primary business (MI2 Impex)
  let business1 = await prisma.business.findFirst({ where: { name: 'MI2 Impex' } });
  if (!business1) {
    business1 = await prisma.business.create({
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
  }

  // Ensure Categories (Folders and Batteries)
  let foldersCat = await prisma.category.findFirst({ where: { businessId: business1.id, name: 'Folders' } });
  if (!foldersCat) {
    foldersCat = await prisma.category.create({
      data: {
        businessId: business1.id,
        name: 'Folders',
        description: 'Folder assemblies, screens, LCDs & OLED displays',
      },
    });
  }

  let batteriesCat = await prisma.category.findFirst({ where: { businessId: business1.id, name: 'Batteries' } });
  if (!batteriesCat) {
    batteriesCat = await prisma.category.create({
      data: {
        businessId: business1.id,
        name: 'Batteries',
        description: 'Original, OEM, high-capacity replacement batteries',
      },
    });
  }

  // Ensure default locations exist (Godown, Store 1, Store 2)
  const locations = await StockEngine.ensureDefaultLocations(business1.id, prisma);
  const godown = locations.find((l) => l.type === 'GODOWN') || locations[0];
  const store1 = locations.find((l) => l.name === 'Store 1') || locations[1];
  const store2 = locations.find((l) => l.name === 'Store 2') || locations[2];

  // Master Mobile Spare Parts Catalog
  const masterProducts = [
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
      minStock: 15,
      warranty: '7 Days Testing Warranty',
      categoryId: foldersCat.id,
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
      categoryId: foldersCat.id,
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
      categoryId: foldersCat.id,
    },
    {
      name: 'Vivo Y20 Folder Assembly',
      brand: 'Vivo',
      model: 'Y20 / Y20i / Y20s',
      partType: 'Display',
      variant: 'Black Frame',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'DISP-VIV-Y20',
      aliases: 'Vivo Y20 LCD, Y20 Folder, Vivo Y20 Display',
      barcode: '890123456705',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 980.0,
      sellingPrice: 1350.0,
      mrp: 1800.0,
      currentStock: 40,
      goodStock: 40,
      minStock: 10,
      warranty: '7 Days Testing',
      categoryId: foldersCat.id,
    },
    {
      name: 'iPhone 11 Display',
      brand: 'Apple',
      model: 'iPhone 11',
      partType: 'Display',
      variant: 'Black',
      quality: 'OEM',
      unit: 'PCS',
      itemCode: 'DISP-IP11',
      aliases: 'iPhone 11 Screen, IP11 Display, iPhone 11 LCD',
      barcode: '890123456709',
      hsn: '8517',
      gstPercentage: 18.0,
      purchasePrice: 2200.0,
      sellingPrice: 2950.0,
      mrp: 3500.0,
      currentStock: 35,
      goodStock: 35,
      minStock: 5,
      warranty: '7 Days Testing',
      categoryId: foldersCat.id,
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
      categoryId: batteriesCat.id,
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
      categoryId: batteriesCat.id,
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
      categoryId: batteriesCat.id,
    },
    {
      name: 'BLP793 Battery (Oppo A15 / A15s)',
      brand: 'Oppo',
      model: 'A15 / A15s / A16',
      partType: 'Battery',
      variant: '4230 mAh BLP793',
      quality: 'Original',
      unit: 'PCS',
      itemCode: 'BAT-BLP793',
      aliases: 'BLP793, BLP 793, Oppo A15 Battery, BLP793 Battery',
      barcode: '890123456711',
      hsn: '8507',
      gstPercentage: 18.0,
      purchasePrice: 380.0,
      sellingPrice: 650.0,
      mrp: 899.0,
      currentStock: 50,
      goodStock: 50,
      minStock: 10,
      warranty: '6 Months Warranty',
      categoryId: batteriesCat.id,
    },
  ];

  for (const prod of masterProducts) {
    const existing = await prisma.product.findFirst({
      where: { businessId: business1.id, name: prod.name },
    });
    if (!existing) {
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
          note: 'Master catalog stock initialization',
        },
      });
    }
  }

  // Ensure common stock synchronization across Godown, Store 1, Store 2
  await StockEngine.syncBusinessStocks(business1.id);

  console.log('✅ BIRD Database successfully seeded with Master Catalog and synchronized stock across Godown, Store 1, Store 2!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
