import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting RBAC & Profit/Loss (P&L) System Automated Verification...\n');
  let passed = 0;
  let failed = 0;

  // 1. Fetch businesses
  const bRes = await fetch(`${API_BASE}/businesses`);
  const businesses = await bRes.json();
  const business = businesses[0];
  const businessId = business.id;
  console.log(`🏢 Active Business: ${business.name} (${businessId})`);

  // Test 1: Admin creating a store -> Should succeed (201)
  console.log('\n--- TEST 1: Admin Store Creation ---');
  const adminStoreRes = await fetch(`${API_BASE}/locations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'OWNER',
    },
    body: JSON.stringify({
      businessId,
      name: 'Test Admin Branch',
      type: 'STORE',
      address: 'Test Address 101',
    }),
  });
  console.log(`Status: ${adminStoreRes.status}`);
  if (adminStoreRes.status === 201) {
    const newLoc = await adminStoreRes.json();
    console.log(`✅ Admin successfully created store: ${newLoc.name} (ID: ${newLoc.id})`);
    passed++;

    // Clean up test store
    await fetch(`${API_BASE}/locations/${newLoc.id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'OWNER' },
    });
  } else {
    console.log(`❌ Admin store creation failed:`, await adminStoreRes.text());
    failed++;
  }

  // Test 2: Employee attempting to create a store -> Should be FORBIDDEN (403)
  console.log('\n--- TEST 2: Employee Store Creation Security Block ---');
  const employeeStoreRes = await fetch(`${API_BASE}/locations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'EMPLOYEE',
    },
    body: JSON.stringify({
      businessId,
      name: 'Unauthorized Employee Store',
      type: 'STORE',
    }),
  });
  console.log(`Status: ${employeeStoreRes.status}`);
  if (employeeStoreRes.status === 403) {
    console.log('✅ Employee store creation was properly BLOCKED with 403 Forbidden!');
    passed++;
  } else {
    console.log(`❌ Employee store creation was NOT blocked (Status: ${employeeStoreRes.status})`);
    failed++;
  }

  // Test 3: Admin accessing P&L Summary -> Should succeed (200) across all periods
  console.log('\n--- TEST 3: Admin Profit & Loss (P&L) Multi-Period Analytics ---');
  const periods = ['today', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'];
  for (const p of periods) {
    const pnlRes = await fetch(`${API_BASE}/reports/pnl/summary?businessId=${businessId}&period=${p}`, {
      headers: { 'x-user-role': 'OWNER' },
    });
    if (pnlRes.status === 200) {
      const pnlData = await pnlRes.json();
      console.log(`✅ Period [${p.toUpperCase()}]: Revenue=₹${pnlData.totalNetSales}, COGS=₹${pnlData.totalCOGS}, GrossProfit=₹${pnlData.grossProfit} (${pnlData.grossMarginPercent}%), NetProfit=₹${pnlData.netProfit} (${pnlData.netProfitMarginPercent}%)`);
      passed++;
    } else {
      console.log(`❌ Period [${p}] failed with status: ${pnlRes.status}`);
      failed++;
    }
  }

  // Test 4: Employee attempting to access P&L Summary -> Should be FORBIDDEN (403)
  console.log('\n--- TEST 4: Employee P&L Financial Access Security Block ---');
  const employeePnlRes = await fetch(`${API_BASE}/reports/pnl/summary?businessId=${businessId}&period=monthly`, {
    headers: { 'x-user-role': 'EMPLOYEE' },
  });
  console.log(`Status: ${employeePnlRes.status}`);
  if (employeePnlRes.status === 403) {
    console.log('✅ Employee access to Profit & Loss was properly BLOCKED with 403 Forbidden!');
    passed++;
  } else {
    console.log(`❌ Employee P&L access was NOT blocked (Status: ${employeePnlRes.status})`);
    failed++;
  }

  // Test 5: Per-Bill P&L (Admin) -> Should return item-level profit breakdown
  console.log('\n--- TEST 5: Per-Bill Profit & Loss with Itemized Profit Breakdown ---');
  const billsPnlRes = await fetch(`${API_BASE}/reports/pnl/bills?businessId=${businessId}&period=all`, {
    headers: { 'x-user-role': 'OWNER' },
  });
  if (billsPnlRes.status === 200) {
    const billsPnlData = await billsPnlRes.json();
    console.log(`✅ Fetched ${billsPnlData.bills?.length || 0} bills with exact Profit & Loss`);
    if (billsPnlData.bills?.length > 0) {
      const firstBill = billsPnlData.bills[0];
      console.log(`   Sample Bill #${firstBill.billNo}: Customer="${firstBill.customerName}", Total=₹${firstBill.total}, Cost=₹${firstBill.cogs}, GrossProfit=₹${firstBill.grossProfit} (${firstBill.profitMargin}%)`);
      if (firstBill.items?.length > 0) {
        console.log(`   Item 1: ${firstBill.items[0].productName} -> Sell Rate: ₹${firstBill.items[0].unitPrice}, Purchase Cost: ₹${firstBill.items[0].purchasePrice}, Line Profit: ₹${firstBill.items[0].lineProfit} (${firstBill.items[0].lineMargin}%)`);
      }
    }
    passed++;
  } else {
    console.log(`❌ Bills P&L failed:`, billsPnlRes.status);
    failed++;
  }

  // Test 6: Per-Customer Profitability (Admin)
  console.log('\n--- TEST 6: Per-Customer Profitability Ranking ---');
  const custPnlRes = await fetch(`${API_BASE}/reports/pnl/customers?businessId=${businessId}&period=all`, {
    headers: { 'x-user-role': 'OWNER' },
  });
  if (custPnlRes.status === 200) {
    const custPnlData = await custPnlRes.json();
    console.log(`✅ Customer ranking generated (${custPnlData.length} customers)`);
    if (custPnlData.length > 0) {
      console.log(`   Top Customer: ${custPnlData[0].customerName} -> Generated Profit: ₹${custPnlData[0].grossProfit} on Revenue: ₹${custPnlData[0].totalRevenue} (Margin: ${custPnlData[0].profitMargin}%)`);
    }
    passed++;
  } else {
    console.log(`❌ Customer P&L failed:`, custPnlRes.status);
    failed++;
  }

  // Test 7: Employee Operational Capabilities (Making a bill) -> Should SUCCEED (201)
  console.log('\n--- TEST 7: Employee Operational Billing (POS Bill Creation) ---');
  const prodsRes = await fetch(`${API_BASE}/products?businessId=${businessId}`);
  const prods = await prodsRes.json();
  const sampleProduct = prods[0];

  const locsRes = await fetch(`${API_BASE}/locations?businessId=${businessId}`);
  const locs = await locsRes.json();
  const sampleStore = locs.find(l => l.type === 'STORE') || locs[0];

  const employeeBillRes = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'EMPLOYEE',
    },
    body: JSON.stringify({
      businessId,
      locationId: sampleStore.id,
      customerName: 'Test Employee Customer',
      customerPhone: '9999911111',
      items: [
        {
          productId: sampleProduct.id,
          productName: sampleProduct.name,
          quantity: 1,
          unitPrice: sampleProduct.sellingPrice || 1000,
          discount: 0,
        },
      ],
      paidAmount: sampleProduct.sellingPrice || 1000,
      paymentMethod: 'CASH',
    }),
  });

  if (employeeBillRes.status === 201) {
    const createdBill = await employeeBillRes.json();
    console.log(`✅ Employee successfully created bill #${createdBill.billNo} for ₹${createdBill.total}!`);
    passed++;
  } else {
    console.log(`❌ Employee bill creation failed:`, await employeeBillRes.text());
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`🏆 RBAC & P&L VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);
}

runTests().catch(console.error);
