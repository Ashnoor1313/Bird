import prisma from '../prisma.js';

export class ProductConsolidator {
  /**
   * Consolidate and merge all duplicate products for a business into single unique primary products.
   * @param {string} businessId
   */
  static async consolidateDuplicates(businessId) {
    if (!businessId) throw new Error('businessId is required for consolidation');

    const products = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        locationStocks: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group products by normalized name and category
    const groups = {};

    for (const prod of products) {
      const cleanName = prod.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const categoryKey = prod.categoryId || 'NOCAT';

      // Create grouping key by clean product name
      const groupKey = `${cleanName}_${categoryKey}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(prod);
    }

    let mergedGroupCount = 0;
    let removedDuplicateCount = 0;

    // Process each group
    for (const key of Object.keys(groups)) {
      const items = groups[key];
      if (items.length <= 1) continue; // No duplicates in this group

      // Pick primary item: prefer item with structured itemCode or DISP code, or earliest created
      let primary = items.find(i => i.itemCode && !i.itemCode.startsWith('ITEM-')) || items[0];

      const duplicates = items.filter(i => i.id !== primary.id);
      mergedGroupCount++;

      for (const dup of duplicates) {
        removedDuplicateCount++;

        // Execute within transaction
        await prisma.$transaction(async (tx) => {
          // 1. Re-link stock movements
          await tx.stockMovement.updateMany({
            where: { productId: dup.id },
            data: { productId: primary.id },
          });

          // 2. Re-link sale items
          await tx.saleItem.updateMany({
            where: { productId: dup.id },
            data: { productId: primary.id },
          });

          // 3. Re-link purchase items
          await tx.purchaseItem.updateMany({
            where: { productId: dup.id },
            data: { productId: primary.id },
          });

          // 4. Merge LocationStock entries
          for (const dupLocStock of dup.locationStocks) {
            const primaryLocStock = await tx.locationStock.findUnique({
              where: {
                businessId_locationId_productId: {
                  businessId,
                  locationId: dupLocStock.locationId,
                  productId: primary.id,
                },
              },
            });

            if (primaryLocStock) {
              await tx.locationStock.update({
                where: { id: primaryLocStock.id },
                data: {
                  goodStock: primaryLocStock.goodStock + dupLocStock.goodStock,
                  defectiveStock: primaryLocStock.defectiveStock + dupLocStock.defectiveStock,
                  testingStock: primaryLocStock.testingStock + dupLocStock.testingStock,
                  quantity: primaryLocStock.quantity + dupLocStock.quantity,
                },
              });
            } else {
              await tx.locationStock.create({
                data: {
                  businessId,
                  locationId: dupLocStock.locationId,
                  productId: primary.id,
                  goodStock: dupLocStock.goodStock,
                  defectiveStock: dupLocStock.defectiveStock,
                  testingStock: dupLocStock.testingStock,
                  quantity: dupLocStock.quantity,
                  minStock: dupLocStock.minStock,
                },
              });
            }
          }

          // Delete duplicate's location stocks
          await tx.locationStock.deleteMany({
            where: { productId: dup.id },
          });

          // Archive/Delete duplicate product
          await tx.product.delete({
            where: { id: dup.id },
          });
        });
      }

      // Recalculate primary product total stock from merged locationStocks
      const updatedLocStocks = await prisma.locationStock.findMany({
        where: { productId: primary.id },
      });

      const totalCurrent = updatedLocStocks.reduce((sum, ls) => sum + ls.quantity, 0);
      const totalGood = updatedLocStocks.reduce((sum, ls) => sum + ls.goodStock, 0);
      const totalDefective = updatedLocStocks.reduce((sum, ls) => sum + ls.defectiveStock, 0);
      const totalTesting = updatedLocStocks.reduce((sum, ls) => sum + ls.testingStock, 0);

      // Ensure primary has a unique item code if missing
      const finalItemCode = primary.itemCode || `ITEM-${Math.floor(1000 + Math.random() * 9000)}`;

      await prisma.product.update({
        where: { id: primary.id },
        data: {
          itemCode: finalItemCode,
          currentStock: totalCurrent,
          goodStock: totalGood,
          defectiveStock: totalDefective,
          testingStock: totalTesting,
        },
      });
    }

    return {
      success: true,
      mergedGroups: mergedGroupCount,
      removedDuplicates: removedDuplicateCount,
    };
  }
}
