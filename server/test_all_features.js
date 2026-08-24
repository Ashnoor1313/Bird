import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function testAllFeatures() {
  console.log('🚀 STARTING COMPREHENSIVE BIRD PLATFORM VERIFICATION TEST...\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  };

  try {
    // 1. Health Check
    console.log('1. Testing Health Check & Server Status...');
    const healthRes = await fetch(`${API_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.ok && healthData.status === 'ok', 'Server health check returns OK status');

    // 2. Business Module
    console.log('\n2. Testing Businesses Module...');
    const busRes = await fetch(`${API_URL}/businesses`);
    const businesses = await busRes.json();
    assert(Array.isArray(businesses) && businesses.length > 0, `Fetched ${businesses.length} active business(es)`);
    const activeBusiness = businesses[0];
    const businessId = activeBusiness.id;

    // 3. Products & Tier Pricing Module
    console.log('\n3. Testing Product Creation with Customer Tier Pricing...');
    const prodRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        name: `iPhone 13 Display Pro (${Date.now()})`,
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        partType: 'Display',
        quality: 'Original',
        purchasePrice: 4200,
        sellingPrice: 5800,
        repairShopPrice: 5400,
        dealerPrice: 5100,
        wholesalePrice: 4800,
        currentStock: 15,
        minStock: 3,
        warranty: '15 Days Testing',
      }),
    });
    const createdProd = await prodRes.json();
    assert(prodRes.ok && createdProd.id && createdProd.repairShopPrice === 5400, `Created product '${createdProd.name}' with stock: ${createdProd.currentStock}`);

    // Fetch Products List
    const prodsListRes = await fetch(`${API_URL}/products?businessId=${businessId}`);
    const prodsList = await prodsListRes.json();
    assert(Array.isArray(prodsList) && prodsList.length > 0, `Fetched ${prodsList.length} products from inventory`);

    // 4. Customers & Customer Tier Price Level
    console.log('\n4. Testing Customers & Price Levels...');
    const custRes = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        name: `Test Repair Workshop ${Date.now().toString().slice(-4)}`,
        phone: `+91 99887 ${Date.now().toString().slice(-5)}`,
        priceLevel: 'REPAIR_SHOP',
        openingBalance: 5000,
      }),
    });
    const createdCust = await custRes.json();
    assert(custRes.ok && createdCust.id && createdCust.priceLevel === 'REPAIR_SHOP', 'Created Customer with REPAIR_SHOP price level & opening balance');

    // 5. Sales / Make Bill Module
    console.log('\n5. Testing Sales Bill Creation & Automatic Stock Reduction...');
    const saleRes = await fetch(`${API_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        customerId: createdCust.id,
        customerName: createdCust.name,
        customerPhone: createdCust.phone,
        items: [
          {
            productId: createdProd.id,
            productName: createdProd.name,
            model: createdProd.model,
            quality: createdProd.quality,
            quantity: 2,
            unitPrice: createdProd.repairShopPrice,
            gstPercentage: 18,
          },
        ],
        paidAmount: 5000,
        paymentMethod: 'UPI',
        notes: 'Test verification sale',
      }),
    });
    const createdSale = await saleRes.json();
    assert(saleRes.ok && createdSale.id && createdSale.total > 0, `Sale created successfully #${createdSale.billNo}`);

    // Verify Stock Reduced automatically
    const updatedProdRes = await fetch(`${API_URL}/products/${createdProd.id}`);
    const updatedProd = await updatedProdRes.json();
    assert(updatedProd.currentStock === 13, `Stock reduced from 15 to ${updatedProd.currentStock} pcs after sale`);

    // 6. Order Management (Quotations, Sales Orders)
    console.log('\n6. Testing Quotations & Document Conversion...');
    const quoteRes = await fetch(`${API_URL}/orders/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        customerId: createdCust.id,
        customerName: createdCust.name,
        customerPhone: createdCust.phone,
        items: [
          {
            productId: createdProd.id,
            productName: createdProd.name,
            quantity: 5,
            unitPrice: createdProd.repairShopPrice,
          },
        ],
        notes: 'Test estimate',
      }),
    });
    const createdQuote = await quoteRes.json();
    assert(quoteRes.ok && createdQuote.id, `Created Quotation estimate #${createdQuote.quoteNo}`);

    // Convert Quotation to Sales Order
    const convertRes = await fetch(`${API_URL}/orders/quotations/${createdQuote.id}/convert`, {
      method: 'POST',
    });
    const convertedOrder = await convertRes.json();
    assert(convertRes.ok && convertedOrder.id, `Converted Quotation into Sales Order #${convertedOrder.orderNo}`);

    // 7. Purchases Module
    console.log('\n7. Testing Purchase Intake & Supplier Khata...');
    const suppRes = await fetch(`${API_URL}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        name: 'Gaffar Wholesaler Traders',
        phone: '+91 98111 22233',
        openingBalance: 10000,
      }),
    });
    const createdSupp = await suppRes.json();

    const purRes = await fetch(`${API_URL}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        supplierId: createdSupp.id,
        supplierName: createdSupp.name,
        billNo: 'GAFFAR-801',
        items: [
          {
            productId: createdProd.id,
            productName: createdProd.name,
            quantity: 10,
            unitPrice: 4000,
            gstPercentage: 18,
          },
        ],
        paidAmount: 20000,
        paymentMethod: 'BANK',
      }),
    });
    const createdPur = await purRes.json();
    assert(purRes.ok && createdPur.id, `Purchase created #${createdPur.purchaseNo}`);

    // Verify Stock Increased
    const prodAfterPur = await (await fetch(`${API_URL}/products/${createdProd.id}`)).json();
    assert(prodAfterPur.currentStock === 23, `Stock increased from 13 to ${prodAfterPur.currentStock} pcs after purchase`);

    // 8. Money & Payments Module
    console.log('\n8. Testing Receive & Pay Money...');
    const payRecRes = await fetch(`${API_URL}/money/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        customerId: createdCust.id,
        customerName: createdCust.name,
        amount: 2000,
        paymentMethod: 'UPI',
        reference: 'UPI_REF_9910',
        notes: 'Payment received on Khata',
      }),
    });
    const payRec = await payRecRes.json();
    assert(payRecRes.ok && payRec.id, 'Received money recorded successfully');

    const payOutRes = await fetch(`${API_URL}/money/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        supplierId: createdSupp.id,
        supplierName: createdSupp.name,
        amount: 5000,
        paymentMethod: 'BANK',
        reference: 'NEFT_9920',
        notes: 'Paid supplier payout',
      }),
    });
    const payOut = await payOutRes.json();
    assert(payOutRes.ok && payOut.id, 'Paid money recorded successfully');

    // 9. OCR Scan Module
    console.log('\n9. Testing Handwritten Stock Slip OCR Scan...');
    let scanData = null;
    try {
      const fs = await import('fs');
      const invoicePath = fs.existsSync('../invoice_preview.png') ? '../invoice_preview.png' : 'uploads/invoice_preview.png';
      if (fs.existsSync(invoicePath)) {
        const fileBuffer = fs.readFileSync(invoicePath);
        const blob = new Blob([fileBuffer], { type: 'image/png' });
        const formData = new FormData();
        formData.append('businessId', businessId);
        formData.append('billFile', blob, 'invoice_preview.png');

        const scanRes = await fetch(`${API_URL}/purchases/scan`, {
          method: 'POST',
          body: formData,
        });
        scanData = await scanRes.json();
        assert(scanRes.ok && scanData.items && scanData.items.length > 0, `OCR scan returned ${scanData.items?.length} items`);
      } else {
        console.log('  ⚠️ Skipping OCR image test (no test image found)');
      }
    } catch (e) {
      console.log('  ⚠️ OCR test error:', e.message);
    }

    // 10. Dashboard & Reports
    console.log('\n10. Testing Dashboard & Reports Summary...');
    const dashRes = await fetch(`${API_URL}/reports/dashboard?businessId=${businessId}`);
    const dash = await dashRes.json();
    assert(dashRes.ok && dash.todaySales !== undefined && dash.stockValue !== undefined, `Dashboard loaded (Today Sales: ₹${dash.todaySales}, Stock Value: ₹${dash.stockValue})`);

    console.log('\n==================================================');
    console.log(`📊 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
    console.log('==================================================\n');

  } catch (err) {
    console.error('❌ Test suite crash:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testAllFeatures();
