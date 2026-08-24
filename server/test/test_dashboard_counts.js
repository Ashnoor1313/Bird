import fetch from 'node-fetch';

async function testDashboard() {
  const bRes = await fetch('http://localhost:5000/api/businesses');
  const [biz] = await bRes.json();

  console.log(`\n🏢 Testing Dashboard for: ${biz.name} (${biz.id})\n`);

  // 1. All Locations view
  const resAll = await fetch(`http://localhost:5000/api/reports/dashboard?businessId=${biz.id}&locationId=ALL`);
  const dataAll = await resAll.json();
  console.log('--- ALL LOCATIONS DASHBOARD ---');
  console.log(`Total Stock: ${dataAll.totalStockPcs} pcs | Value: ₹${dataAll.stockValue}`);
  console.log(`Folders Stock: ${dataAll.foldersStockPcs} pcs (Total Models: ${dataAll.foldersProductCount})`);
  console.log(`Batteries Stock: ${dataAll.batteriesStockPcs} pcs (Total Models: ${dataAll.batteriesProductCount})`);

  // 2. Individual Location view (e.g. Godown)
  const locsRes = await fetch(`http://localhost:5000/api/locations?businessId=${biz.id}`);
  const locs = await locsRes.json();
  for (const loc of locs) {
    const resLoc = await fetch(`http://localhost:5000/api/reports/dashboard?businessId=${biz.id}&locationId=${loc.id}`);
    const dataLoc = await resLoc.json();
    console.log(`\n--- LOCATION [${loc.name}] (${loc.type}) ---`);
    console.log(`Total Stock: ${dataLoc.totalStockPcs} pcs | Value: ₹${dataLoc.stockValue}`);
    console.log(`Folders Stock: ${dataLoc.foldersStockPcs} pcs`);
    console.log(`Batteries Stock: ${dataLoc.batteriesStockPcs} pcs`);
  }
}

testDashboard().catch(console.error);
