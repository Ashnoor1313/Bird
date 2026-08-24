import { PrismaClient } from '@prisma/client';
import { ProductNormalizer } from '../services/ProductNormalizer.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning all product names and stripping noise words (incell, wd, bid, cc, bord, oem, etc.)...');

  const products = await prisma.product.findMany();
  let updatedCount = 0;

  for (const p of products) {
    const cleaned = ProductNormalizer.stripNoiseWords(p.name);
    if (cleaned && cleaned !== p.name) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          name: cleaned,
          partType: p.partType === 'Battery' ? 'Battery' : 'Display',
        },
      });
      console.log(`✨ Cleaned: "${p.name}" -> "${cleaned}"`);
      updatedCount++;
    }
  }

  console.log(`🎉 Finished cleaning database! Updated ${updatedCount} products.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error stripping noise words:', err);
  process.exit(1);
});
