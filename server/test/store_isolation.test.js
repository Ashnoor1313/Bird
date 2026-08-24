import { PrismaClient } from '@prisma/client';
import { LedgerEngine } from '../src/services/LedgerEngine.js';

const prisma = new PrismaClient();

async function runStoreIsolationTests() {
  console.log('🧪 Starting BIRD Store Isolation Automated Test Suite...\n');
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
    // 1. Setup Test Business and 2 Stores
    const business = await prisma.business.create({
      data: {
        name: 'Test Isolation Business',
        phone: '+91 99000 00000',
      },
    });

    const store1 = await prisma.location.create({
      data: {
        businessId: business.id,
        name: 'Store 1 Test Outlet',
        type: 'STORE',
      },
    });

    const store2 = await prisma.location.create({
      data: {
        businessId: business.id,
        name: 'Store 2 Test Outlet',
        type: 'STORE',
      },
    });

    // TEST 1: Customer & Payment Isolation
    const c1 = await prisma.customer.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        name: 'Rahul Mobile',
        phone: '9876543210',
        moneyToReceive: 25000,
      },
    });

    const c2 = await prisma.customer.create({
      data: {
        businessId: business.id,
        locationId: store2.id,
        name: 'Rahul Mobile',
        phone: '9876543210', // Same phone allowed in different store
        moneyToReceive: 10000,
      },
    });

    assert(c1.id !== c2.id, 'Store 1 and Store 2 customers with same name/phone are distinct records');

    // Create Store 1 Payment
    const p1 = await prisma.payment.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        type: 'RECEIVE',
        partyType: 'CUSTOMER',
        customerId: c1.id,
        partyName: c1.name,
        amount: 5000,
      },
    });

    await LedgerEngine.recordCustomerTransaction({
      businessId: business.id,
      locationId: store1.id,
      customerId: c1.id,
      type: 'PAYMENT',
      reference: 'PAY-1',
      amount: 5000,
    });

    // Create Store 2 Payment
    const p2 = await prisma.payment.create({
      data: {
        businessId: business.id,
        locationId: store2.id,
        type: 'RECEIVE',
        partyType: 'CUSTOMER',
        customerId: c2.id,
        partyName: c2.name,
        amount: 2000,
      },
    });

    await LedgerEngine.recordCustomerTransaction({
      businessId: business.id,
      locationId: store2.id,
      customerId: c2.id,
      type: 'PAYMENT',
      reference: 'PAY-2',
      amount: 2000,
    });

    // Fetch updated balances
    const c1Updated = await prisma.customer.findUnique({ where: { id: c1.id } });
    const c2Updated = await prisma.customer.findUnique({ where: { id: c2.id } });

    assert(c1Updated.moneyToReceive === 20000, `Store 1 C001 balance reduced by 5000 (New: ${c1Updated.moneyToReceive})`);
    assert(c2Updated.moneyToReceive === 8000, `Store 2 C002 balance reduced by 2000 (New: ${c2Updated.moneyToReceive})`);

    // Verify Payment list isolation
    const store1Payments = await prisma.payment.findMany({ where: { businessId: business.id, locationId: store1.id } });
    const store2Payments = await prisma.payment.findMany({ where: { businessId: business.id, locationId: store2.id } });

    assert(store1Payments.length === 1 && store1Payments[0].amount === 5000, 'Store 1 payment query returns only Store 1 payment (5000)');
    assert(store2Payments.length === 1 && store2Payments[0].amount === 2000, 'Store 2 payment query returns only Store 2 payment (2000)');

    // TEST 2: Expense Isolation
    await prisma.expense.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        category: 'Rent',
        amount: 5000,
      },
    });

    await prisma.expense.create({
      data: {
        businessId: business.id,
        locationId: store2.id,
        category: 'Electricity',
        amount: 2000,
      },
    });

    const store1Expenses = await prisma.expense.aggregate({ where: { businessId: business.id, locationId: store1.id }, _sum: { amount: true } });
    const store2Expenses = await prisma.expense.aggregate({ where: { businessId: business.id, locationId: store2.id }, _sum: { amount: true } });
    const bizExpenses = await prisma.expense.aggregate({ where: { businessId: business.id }, _sum: { amount: true } });

    assert(store1Expenses._sum.amount === 5000, 'Store 1 expenses aggregate = 5000');
    assert(store2Expenses._sum.amount === 2000, 'Store 2 expenses aggregate = 2000');
    assert(bizExpenses._sum.amount === 7000, 'Business wide consolidated expenses aggregate = 7000');

    // TEST 3: Supplier & Payable Isolation
    const s1 = await prisma.supplier.create({
      data: {
        businessId: business.id,
        locationId: store1.id,
        name: 'ABC Mobile Parts',
        phone: '9910088776',
        moneyToPay: 20000,
      },
    });

    const s2 = await prisma.supplier.create({
      data: {
        businessId: business.id,
        locationId: store2.id,
        name: 'ABC Mobile Parts',
        phone: '9910088776',
        moneyToPay: 5000,
      },
    });

    const store1Payables = await prisma.supplier.aggregate({ where: { businessId: business.id, locationId: store1.id }, _sum: { moneyToPay: true } });
    const store2Payables = await prisma.supplier.aggregate({ where: { businessId: business.id, locationId: store2.id }, _sum: { moneyToPay: true } });
    const bizPayables = await prisma.supplier.aggregate({ where: { businessId: business.id }, _sum: { moneyToPay: true } });

    assert(store1Payables._sum.moneyToPay === 20000, 'Store 1 payables = 20000');
    assert(store2Payables._sum.moneyToPay === 5000, 'Store 2 payables = 5000');
    assert(bizPayables._sum.moneyToPay === 25000, 'Business consolidated payables = 25000');

    // TEST 4: Cross-Store Customer Duplicate Constraint within same store
    let duplicateErrorThrown = false;
    try {
      await prisma.customer.create({
        data: {
          businessId: business.id,
          locationId: store1.id,
          name: 'Duplicate Rahul',
          phone: '9876543210', // Same phone in SAME store 1 should fail unique(locationId, phone)
        },
      });
    } catch (err) {
      duplicateErrorThrown = true;
    }
    assert(duplicateErrorThrown, 'Duplicate phone number inside SAME store is rejected by database constraint');

    // Clean up test data
    await prisma.business.delete({ where: { id: business.id } });

    // Migrate any existing production sales bills & sync Khata
    await migrateExistingSales();

    console.log(`\n📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Unexpected error during isolation test run:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function migrateExistingSales() {
  console.log('\n🔄 Migrating existing sales bills & updating customer Khata ledgers...');

  const defaultStore = await prisma.location.findFirst({
    where: { type: 'STORE' },
    orderBy: { createdAt: 'asc' },
  });

  const sales = await prisma.sale.findMany({
    include: { customer: true, location: true },
  });

  let migratedCount = 0;

  for (const sale of sales) {
    const targetLocId = sale.locationId || defaultStore?.id;
    let targetCustId = sale.customerId;
    const name = sale.customerName?.trim() || 'Walk-in Customer';

    if (!targetLocId) continue;

    // Auto-create customer if missing
    if (!targetCustId && name && name.toLowerCase() !== 'walk-in customer') {
      let cust = null;
      if (sale.customerPhone?.trim()) {
        cust = await prisma.customer.findFirst({
          where: { businessId: sale.businessId, locationId: targetLocId, phone: sale.customerPhone.trim() },
        });
      }
      if (!cust) {
        cust = await prisma.customer.findFirst({
          where: { businessId: sale.businessId, locationId: targetLocId, name: { equals: name } },
        });
      }
      if (!cust) {
        cust = await prisma.customer.create({
          data: {
            businessId: sale.businessId,
            locationId: targetLocId,
            name: name,
            phone: sale.customerPhone || null,
            priceLevel: 'RETAIL',
            moneyToReceive: 0,
          },
        });
        console.log(`✨ Created customer "${name}" for store ${targetLocId}`);
      }
      targetCustId = cust.id;
    }

    // Update sale record
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        locationId: targetLocId,
        customerId: targetCustId,
        customerName: name,
      },
    });

    // Update Customer Khata ledger
    if (targetCustId) {
      const existingLedger = await prisma.customerLedger.findFirst({
        where: { customerId: targetCustId, reference: sale.billNo, type: 'BILL' },
      });

      if (!existingLedger) {
        await LedgerEngine.recordCustomerTransaction({
          businessId: sale.businessId,
          locationId: targetLocId,
          customerId: targetCustId,
          type: 'BILL',
          reference: sale.billNo,
          amount: sale.total,
          note: `Bill #${sale.billNo}`,
        });

        if (sale.paidAmount > 0) {
          await LedgerEngine.recordCustomerTransaction({
            businessId: sale.businessId,
            locationId: targetLocId,
            customerId: targetCustId,
            type: 'PAYMENT',
            reference: `PAY-${sale.billNo}`,
            amount: sale.paidAmount,
            note: `Payment for Bill #${sale.billNo}`,
          });
        }
      }
    }
    migratedCount++;
  }
  console.log(`✅ Migrated & synced ${migratedCount} existing sales bills!`);
}

runStoreIsolationTests();
