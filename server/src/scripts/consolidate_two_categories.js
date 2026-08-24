import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Consolidating categories into FOLDERS and BATTERIES...');
  const businesses = await prisma.business.findMany();

  for (const b of businesses) {
    // 1. Ensure Folders category exists
    let foldersCat = await prisma.category.findFirst({
      where: {
        businessId: b.id,
        name: { in: ['Folders', 'Display', 'Displays'] },
      },
    });

    if (!foldersCat) {
      foldersCat = await prisma.category.create({
        data: {
          businessId: b.id,
          name: 'Folders',
          description: 'Folder assemblies, screens, LCDs & OLED displays',
        },
      });
    } else {
      await prisma.category.update({
        where: { id: foldersCat.id },
        data: { name: 'Folders' },
      });
    }

    // 2. Ensure Batteries category exists
    let batteriesCat = await prisma.category.findFirst({
      where: {
        businessId: b.id,
        name: { in: ['Batteries', 'Battery'] },
      },
    });

    if (!batteriesCat) {
      batteriesCat = await prisma.category.create({
        data: {
          businessId: b.id,
          name: 'Batteries',
          description: 'Original, OEM, high-capacity replacement batteries',
        },
      });
    } else {
      await prisma.category.update({
        where: { id: batteriesCat.id },
        data: { name: 'Batteries' },
      });
    }

    // 3. Map all products into Folders or Batteries
    const products = await prisma.product.findMany({
      where: { businessId: b.id },
    });

    for (const p of products) {
      const text = `${p.name} ${p.partType || ''}`.toLowerCase();
      if (text.includes('batter') || text.includes('batt') || text.includes('mah') || text.includes('cell')) {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: batteriesCat.id,
            partType: 'Battery',
          },
        });
      } else {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: foldersCat.id,
            partType: 'Display',
          },
        });
      }
    }

    // 4. Clean up other empty categories
    await prisma.category.deleteMany({
      where: {
        businessId: b.id,
        id: { notIn: [foldersCat.id, batteriesCat.id] },
      },
    });

    console.log(`✅ Business ${b.name}: Configured 2 primary categories: Folders (${foldersCat.id}) & Batteries (${batteriesCat.id})`);
  }

  console.log('🎉 Category consolidation complete!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error consolidating categories:', err);
  process.exit(1);
});
