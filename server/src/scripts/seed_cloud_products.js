import prisma from '../prisma.js';

export const INITIAL_PRODUCTS = [
  { name: '11 Pro Max', brand: 'Apple', model: '11 Pro Max', partType: 'Folder / Display', purchasePrice: 900, sellingPrice: 1100, currentStock: 10, isBattery: false },
  { name: '12 Pro Max', brand: 'Apple', model: '12 Pro Max', partType: 'Folder / Display', purchasePrice: 1000, sellingPrice: 1150, currentStock: 12, isBattery: false },
  { name: 'Xs max', brand: 'Apple', model: 'Xs Max', partType: 'Folder / Display', purchasePrice: 800, sellingPrice: 980, currentStock: 1, isBattery: false },
  { name: 'J2', brand: 'Samsung', model: 'J2', partType: 'Folder / Display', purchasePrice: 200, sellingPrice: 300, currentStock: 2, isBattery: false },
  { name: 'J5', brand: 'Samsung', model: 'J5', partType: 'Folder / Display', purchasePrice: 250, sellingPrice: 350, currentStock: 6, isBattery: false },
  { name: 'J7', brand: 'Samsung', model: 'J7', partType: 'Folder / Display', purchasePrice: 300, sellingPrice: 400, currentStock: 6, isBattery: false },
  { name: 'J7 prime', brand: 'Samsung', model: 'J7 Prime', partType: 'Folder / Display', purchasePrice: 350, sellingPrice: 450, currentStock: 4, isBattery: false },
  { name: 'A10', brand: 'Samsung', model: 'A10', partType: 'Folder / Display', purchasePrice: 400, sellingPrice: 500, currentStock: 2, isBattery: false },
  { name: 'A10S', brand: 'Samsung', model: 'A10S No Symbol', partType: 'Folder / Display', purchasePrice: 450, sellingPrice: 550, currentStock: 1, isBattery: false },
  { name: 'A11', brand: 'Samsung', model: 'A11', partType: 'Folder / Display', purchasePrice: 500, sellingPrice: 550, currentStock: 1, isBattery: false },
  { name: 'A12', brand: 'Samsung', model: 'A12', partType: 'Folder / Display', purchasePrice: 550, sellingPrice: 650, currentStock: 2, isBattery: false },
  { name: 'A14 4g', brand: 'Samsung', model: 'A14 4G', partType: 'Folder / Display', purchasePrice: 600, sellingPrice: 700, currentStock: 2, isBattery: false },
  { name: 'A145g', brand: 'Samsung', model: 'A14 5G', partType: 'Folder / Display', purchasePrice: 650, sellingPrice: 750, currentStock: 2, isBattery: false },
  { name: 'A31', brand: 'Samsung', model: 'A31', partType: 'Folder / Display', purchasePrice: 700, sellingPrice: 850, currentStock: 3, isBattery: false },
  { name: 'A50', brand: 'Samsung', model: 'A50', partType: 'Folder / Display', purchasePrice: 750, sellingPrice: 900, currentStock: 1, isBattery: false },
  { name: 'A51', brand: 'Samsung', model: 'A51', partType: 'Folder / Display', purchasePrice: 800, sellingPrice: 950, currentStock: 1, isBattery: false },
  { name: 'A70', brand: 'Samsung', model: 'A70', partType: 'Folder / Display', purchasePrice: 850, sellingPrice: 1000, currentStock: 1, isBattery: false },
  { name: 'M11', brand: 'Samsung', model: 'M11', partType: 'Folder / Display', purchasePrice: 500, sellingPrice: 600, currentStock: 1, isBattery: false },
  { name: 'G9 lite', brand: 'Huawei', model: 'G9 Lite', partType: 'Folder / Display', purchasePrice: 400, sellingPrice: 500, currentStock: 1, isBattery: false },
  { name: '58 Bt', brand: 'Universal', model: '58 Bt', partType: 'Folder / Display', purchasePrice: 450, sellingPrice: 550, currentStock: 2, isBattery: false },
  { name: '58 Bx', brand: 'Universal', model: '58 Bx', partType: 'Folder / Display', purchasePrice: 450, sellingPrice: 550, currentStock: 2, isBattery: false },
  { name: '49 Ft', brand: 'Universal', model: '49 Ft', partType: 'Folder / Display', purchasePrice: 500, sellingPrice: 600, currentStock: 8, isBattery: false },
  { name: '49 Lx', brand: 'Universal', model: '49 Lx', partType: 'Folder / Display', purchasePrice: 500, sellingPrice: 600, currentStock: 1, isBattery: false },
  { name: '49 Nt', brand: 'Universal', model: '49 Nt', partType: 'Folder / Display', purchasePrice: 500, sellingPrice: 600, currentStock: 2, isBattery: false },
  { name: '49 Fx', brand: 'Universal', model: '49 Fx', partType: 'Folder / Display', purchasePrice: 500, sellingPrice: 600, currentStock: 4, isBattery: false },
  { name: '39 LI', brand: 'Universal', model: '39 LI', partType: 'Folder / Display', purchasePrice: 600, sellingPrice: 700, currentStock: 4, isBattery: false },
  { name: '39 Lt', brand: 'Universal', model: '39 Lt', partType: 'Folder / Display', purchasePrice: 650, sellingPrice: 750, currentStock: 1, isBattery: false },
  { name: '36 Bt', brand: 'Universal', model: '36 Bt', partType: 'Folder / Display', purchasePrice: 650, sellingPrice: 750, currentStock: 1, isBattery: false },
  { name: 'Jk50', brand: 'Universal', model: 'JK50 Battery', partType: 'Battery', purchasePrice: 350, sellingPrice: 450, currentStock: 15, isBattery: true },
];

export async function seedProductsIfEmpty(businessId) {
  try {
    const count = await prisma.product.count({ where: { businessId } });
    if (count > 0) return;

    const foldersCat = await prisma.category.findFirst({ where: { businessId, name: 'Folders' } });
    const batteriesCat = await prisma.category.findFirst({ where: { businessId, name: 'Batteries' } });
    const godown = await prisma.location.findFirst({ where: { businessId, type: 'GODOWN' } });
    const store1 = await prisma.location.findFirst({ where: { businessId, name: 'Store 1' } });
    const store2 = await prisma.location.findFirst({ where: { businessId, name: 'Store 2' } });

    console.log('🌱 Seeding initial inventory products into cloud database...');

    for (const p of INITIAL_PRODUCTS) {
      const catId = p.isBattery ? (batteriesCat?.id || foldersCat?.id) : (foldersCat?.id || batteriesCat?.id);
      const product = await prisma.product.create({
        data: {
          businessId,
          categoryId: catId,
          name: p.name,
          brand: p.brand,
          model: p.model,
          partType: p.partType,
          purchasePrice: p.purchasePrice,
          sellingPrice: p.sellingPrice,
          currentStock: p.currentStock,
          goodStock: p.currentStock,
          minStock: 5,
        },
      });

      // Allocate stock to Godown
      if (godown && p.currentStock > 0) {
        await prisma.locationStock.create({
          data: {
            businessId,
            locationId: godown.id,
            productId: product.id,
            quantity: p.currentStock,
          },
        });
      }

      // Also seed a few initial models in Store 1 & Store 2 for demonstration
      if (store1 && p.name.startsWith('11') || p.name === 'A10S') {
        await prisma.locationStock.create({
          data: {
            businessId,
            locationId: store1.id,
            productId: product.id,
            quantity: 5,
          },
        });
      }

      if (store2 && p.isBattery) {
        await prisma.locationStock.create({
          data: {
            businessId,
            locationId: store2.id,
            productId: product.id,
            quantity: 10,
          },
        });
      }
    }

    console.log(`✅ Seeded ${INITIAL_PRODUCTS.length} products and location stocks into cloud database!`);
  } catch (err) {
    console.warn('Seed products notice:', err.message);
  }
}
