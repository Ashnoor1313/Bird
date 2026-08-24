import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function mergeCategories() {
  console.log('🔄 Merging and standardizing categories to strictly ONLY "Folders" and "Batteries"...\n');

  const businesses = await prisma.business.findMany();

  for (const biz of businesses) {
    console.log(`Processing business: ${biz.name} (${biz.id})`);

    const existingCats = await prisma.category.findMany({
      where: { businessId: biz.id },
      include: { products: true },
    });

    let foldersCat = existingCats.find(c => /folder|display|screen|lcd|oled/i.test(c.name));
    let batteriesCat = existingCats.find(c => /batter/i.test(c.name));

    // 1. Ensure "Folders" category exists and named "Folders"
    if (!foldersCat) {
      foldersCat = await prisma.category.create({
        data: { businessId: biz.id, name: 'Folders' },
      });
      console.log(`  + Created "Folders" category: ${foldersCat.id}`);
    } else if (foldersCat.name !== 'Folders') {
      foldersCat = await prisma.category.update({
        where: { id: foldersCat.id },
        data: { name: 'Folders' },
      });
      console.log(`  ~ Renamed category to "Folders": ${foldersCat.id}`);
    }

    // 2. Ensure "Batteries" category exists and named "Batteries"
    if (!batteriesCat) {
      batteriesCat = await prisma.category.create({
        data: { businessId: biz.id, name: 'Batteries' },
      });
      console.log(`  + Created "Batteries" category: ${batteriesCat.id}`);
    } else if (batteriesCat.name !== 'Batteries') {
      batteriesCat = await prisma.category.update({
        where: { id: batteriesCat.id },
        data: { name: 'Batteries' },
      });
      console.log(`  ~ Renamed category to "Batteries": ${batteriesCat.id}`);
    }

    // 3. Find all other categories in this business
    const otherCategories = await prisma.category.findMany({
      where: {
        businessId: biz.id,
        id: { notIn: [foldersCat.id, batteriesCat.id] },
      },
      include: { products: true },
    });

    for (const otherCat of otherCategories) {
      console.log(`  - Found extra category: "${otherCat.name}" with ${otherCat.products.length} products`);

      // If category name matches battery, merge into batteriesCat; else merge into foldersCat
      const isBat = /batter|cell|mah/i.test(otherCat.name);
      const targetCat = isBat ? batteriesCat : foldersCat;

      if (otherCat.products.length > 0) {
        await prisma.product.updateMany({
          where: { categoryId: otherCat.id },
          data: {
            categoryId: targetCat.id,
            partType: isBat ? 'Battery' : 'Display',
          },
        });
        console.log(`    -> Moved ${otherCat.products.length} products to "${targetCat.name}"`);
      }

      // Delete the redundant category
      await prisma.category.delete({
        where: { id: otherCat.id },
      });
      console.log(`    -> Deleted category "${otherCat.name}"`);
    }

    // 4. Also assign any products with categoryId: null to Folders or Batteries based on partType/name
    const unassignedProds = await prisma.product.findMany({
      where: {
        businessId: biz.id,
        OR: [
          { categoryId: null },
          { categoryId: { notIn: [foldersCat.id, batteriesCat.id] } },
        ],
      },
    });

    console.log(`  - Checking ${unassignedProds.length} products without valid categoryId`);
    for (const p of unassignedProds) {
      const isBat = /batter|cell|mah/i.test(p.name) || p.partType === 'Battery';
      const targetCatId = isBat ? batteriesCat.id : foldersCat.id;
      await prisma.product.update({
        where: { id: p.id },
        data: {
          categoryId: targetCatId,
          partType: isBat ? 'Battery' : 'Display',
        },
      });
    }

    // 5. Final check for this business
    const finalCats = await prisma.category.findMany({
      where: { businessId: biz.id },
      include: { _count: { select: { products: true } } },
    });
    console.log(`\n  ✅ Final Categories for ${biz.name}:`);
    finalCats.forEach(c => console.log(`     📁 ${c.name}: ${c._count.products} products linked`));
  }

  console.log('\n✨ Database category consolidation complete!');
}

mergeCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
