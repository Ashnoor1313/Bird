import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspectLocs() {
  const business = await prisma.business.findFirst();
  const locations = await prisma.location.findMany({ where: { businessId: business.id } });
  const allProds = await prisma.product.findMany({
    where: { businessId: business.id, status: 'ACTIVE' },
    include: { category: true, locationStocks: true }
  });

  console.log('--- LOCATIONS ---');
  locations.forEach(loc => console.log(`${loc.id} | ${loc.type} | ${loc.name}`));

  for (const loc of locations) {
    let locTotal = 0;
    let locFolder = 0;
    let locBattery = 0;

    allProds.forEach(p => {
      const ls = p.locationStocks.find(s => s.locationId === loc.id);
      const qty = ls ? ls.quantity : p.currentStock; // check if locationStock exists
      locTotal += qty;
      const isFolder = /folder|display|screen|lcd|oled|combo/i.test(p.name) ||
                       /folder|display|screen|lcd|oled|combo/i.test(p.category?.name || '') ||
                       p.partType === 'Display';
      const isBattery = /batter|cell|mah/i.test(p.name) ||
                        /batter|cell|mah/i.test(p.category?.name || '') ||
                        p.partType === 'Battery';
      if (isFolder) locFolder += qty;
      if (isBattery) locBattery += qty;
    });

    console.log(`\nLocation [${loc.name}] (${loc.type}):`);
    console.log(`  Total: ${locTotal} pcs`);
    console.log(`  Folders: ${locFolder} pcs`);
    console.log(`  Batteries: ${locBattery} pcs`);
  }
}

inspectLocs().then(() => prisma.$disconnect());
