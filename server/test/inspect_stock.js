import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspect() {
  const businesses = await prisma.business.findMany();
  for (const b of businesses) {
    console.log(`\n=== BUSINESS: ${b.name} (${b.id}) ===`);
    const totalProds = await prisma.product.count({ where: { businessId: b.id, status: 'ACTIVE' } });
    const allProds = await prisma.product.findMany({
      where: { businessId: b.id, status: 'ACTIVE' },
      include: { category: true, locationStocks: true }
    });

    let totalStock = 0;
    let folderPcs = 0;
    let batteryPcs = 0;

    allProds.forEach(p => {
      totalStock += p.currentStock;
      const isFolder = /folder|display|screen|lcd|oled|combo/i.test(p.name) ||
                       /folder|display|screen|lcd|oled|combo/i.test(p.category?.name || '') ||
                       p.partType === 'Display';
      const isBattery = /batter|cell|mah/i.test(p.name) ||
                        /batter|cell|mah/i.test(p.category?.name || '') ||
                        p.partType === 'Battery';
      if (isFolder) folderPcs += p.currentStock;
      if (isBattery) batteryPcs += p.currentStock;
    });

    console.log(`Total Products: ${totalProds}`);
    console.log(`Total Physical Stock: ${totalStock} pcs`);
    console.log(`Folders / Display Stock: ${folderPcs} pcs`);
    console.log(`Batteries Stock: ${batteryPcs} pcs`);

    const categories = await prisma.category.findMany({
      where: { businessId: b.id },
      include: { products: true }
    });
    console.log('Categories in DB:');
    categories.forEach(c => {
      const pcs = c.products.reduce((sum, p) => sum + p.currentStock, 0);
      console.log(`  - ${c.name}: ${c.products.length} products, ${pcs} pcs`);
    });
  }
}

inspect().then(() => prisma.$disconnect());
