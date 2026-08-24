import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetClean() {
  console.log('🧹 Clearing all pre-existing demo and hardcoded data...');

  // 1. Delete all transactional, customer, supplier, and inventory data
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.locationStock.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.accountBalance.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.userBusiness.deleteMany({});
  await prisma.business.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✨ All old data successfully purged!');
  console.log('🚀 Initializing fresh pristine master setup for MI2 Impex...');

  // 2. Create Owner User
  const hashedPassword = await bcrypt.hash('bird123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Owner Admin',
      email: 'owner@birdparts.com',
      password: hashedPassword,
      role: 'OWNER',
    },
  });

  // 3. Create Clean Business Entity: MI2 Impex
  const business = await prisma.business.create({
    data: {
      name: 'MI2 Impex',
      address: 'Karol Bagh Mobile Spare Market, New Delhi - 110005',
      phone: '+91 98765 43210',
      email: 'sales@mi2impex.com',
      gstin: '07AAAAA0000A1Z5',
      state: 'Delhi',
      billPrefix: 'MI2',
      startingBillNo: 1001,
      bankName: 'HDFC Bank',
      accountNo: '',
      ifscCode: '',
      upiId: '',
      terms: '1. Testing warranty 7 days on displays & batteries before installation.\n2. No warranty on physical or flex damage.',
      users: {
        create: {
          userId: user.id,
        },
      },
    },
  });

  // 4. Create Pristine Locations: Godown & Store 1
  const godown = await prisma.location.create({
    data: {
      businessId: business.id,
      name: 'Godown',
      type: 'GODOWN',
      isDefault: true,
      status: 'ACTIVE',
      address: 'Central Godown / Inward Warehouse',
    },
  });

  const store1 = await prisma.location.create({
    data: {
      businessId: business.id,
      name: 'Store 1',
      type: 'STORE',
      isDefault: false,
      status: 'ACTIVE',
      address: 'Shop Counter / Retail Counter',
    },
  });

  // 5. Create Core Spare-Part Master Categories: Folders & Batteries
  await prisma.category.create({
    data: {
      businessId: business.id,
      name: 'Folders',
      description: 'Folder assemblies, screens, LCDs & OLED displays',
    },
  });

  await prisma.category.create({
    data: {
      businessId: business.id,
      name: 'Batteries',
      description: 'Original, OEM, high-capacity replacement batteries',
    },
  });

  // 6. Zero-Balance Account Initializer
  await prisma.accountBalance.create({
    data: {
      businessId: business.id,
      cashBalance: 0.0,
      bankBalance: 0.0,
      upiBalance: 0.0,
    },
  });

  console.log('✅ FRESH SETUP COMPLETE!');
  console.log(`🏢 Business: ${business.name}`);
  console.log(`📍 Locations: ${godown.name} (Godown), ${store1.name} (Store)`);
  console.log(`📦 Initial Products: 0 (Fresh Start)`);
  console.log(`🧾 Initial Sales/Purchases: 0 (Fresh Start)`);
  console.log(`👥 Initial Customers/Suppliers: 0 (Fresh Start)`);
}

resetClean()
  .catch((e) => {
    console.error('Error resetting database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
