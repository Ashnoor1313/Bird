import prisma from '../prisma.js';

export class StockEngine {
  /**
   * Ensure default locations exist for a business (Godown, Store 1, Store 2).
   * Migrates existing unallocated product stock into Godown.
   */
  static async ensureDefaultLocations(businessId, tx = prisma) {
    let locations = await tx.location.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });

    if (locations.length === 0) {
      const godown = await tx.location.create({
        data: {
          businessId,
          name: 'Godown',
          type: 'GODOWN',
          isDefault: true,
          status: 'ACTIVE',
        },
      });

      const store1 = await tx.location.create({
        data: {
          businessId,
          name: 'Store 1',
          type: 'STORE',
          status: 'ACTIVE',
        },
      });

      const store2 = await tx.location.create({
        data: {
          businessId,
          name: 'Store 2',
          type: 'STORE',
          status: 'ACTIVE',
        },
      });

      locations = [godown, store1, store2];

      // Migrate existing product stocks to Godown
      const products = await tx.product.findMany({ where: { businessId } });
      for (const p of products) {
        if (p.currentStock > 0) {
          await tx.locationStock.upsert({
            where: {
              businessId_locationId_productId: {
                businessId,
                locationId: godown.id,
                productId: p.id,
              },
            },
            create: {
              businessId,
              locationId: godown.id,
              productId: p.id,
              goodStock: p.goodStock || p.currentStock,
              defectiveStock: p.defectiveStock || 0,
              testingStock: p.testingStock || 0,
              quantity: p.currentStock,
              minStock: p.minStock || 5,
            },
            update: {
              goodStock: p.goodStock || p.currentStock,
              defectiveStock: p.defectiveStock || 0,
              testingStock: p.testingStock || 0,
              quantity: p.currentStock,
            },
          });
        }
      }
    }

    return locations;
  }

  /**
   * Get default Godown for a business.
   */
  static async getDefaultGodown(businessId, tx = prisma) {
    const locations = await this.ensureDefaultLocations(businessId, tx);
    return locations.find(l => l.type === 'GODOWN' || l.isDefault) || locations[0];
  }

  /**
   * Get stock quantity for a specific product and location.
   */
  static async getLocationStock(businessId, locationId, productId, tx = prisma) {
    const locStock = await tx.locationStock.findUnique({
      where: {
        businessId_locationId_productId: {
          businessId,
          locationId,
          productId,
        },
      },
    });
    return locStock || { goodStock: 0, defectiveStock: 0, testingStock: 0, reservedStock: 0, quantity: 0, minStock: 5 };
  }

  /**
   * Record a stock movement and update location stock + total business stock.
   * Respects business.allowNegativeStock policy.
   */
  static async recordMovement(
    { businessId, productId, locationId, type, quantity, stockState = 'GOOD', reference, note, createdBy },
    tx = prisma
  ) {
    let targetLocationId = locationId;
    if (!targetLocationId) {
      const defaultGodown = await this.getDefaultGodown(businessId, tx);
      targetLocationId = defaultGodown.id;
    }

    const business = await tx.business.findUnique({ where: { id: businessId } });
    const allowNegativeStock = business?.allowNegativeStock || false;

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Get current Godown location stock
    const currentLocStock = await tx.locationStock.findUnique({
      where: {
        businessId_locationId_productId: {
          businessId,
          locationId: targetLocationId,
          productId,
        },
      },
    });

    let prevLocGood = currentLocStock?.goodStock || 0;
    let prevLocDefective = currentLocStock?.defectiveStock || 0;
    let prevLocTesting = currentLocStock?.testingStock || 0;
    let prevLocReserved = currentLocStock?.reservedStock || 0;

    // Stock can go negative during billing; user can adjust when new inventory arrives
    if (stockState === 'GOOD') {
      prevLocGood = prevLocGood + quantity;
    } else if (stockState === 'DEFECTIVE') {
      prevLocDefective = prevLocDefective + quantity;
    } else if (stockState === 'TESTING') {
      prevLocTesting = prevLocTesting + quantity;
    }

    const newLocTotal = prevLocGood + prevLocDefective + prevLocTesting + prevLocReserved;

    // Upsert LocationStock
    await tx.locationStock.upsert({
      where: {
        businessId_locationId_productId: {
          businessId,
          locationId: targetLocationId,
          productId,
        },
      },
      create: {
        businessId,
        locationId: targetLocationId,
        productId,
        goodStock: stockState === 'GOOD' ? (allowNegativeStock ? quantity : Math.max(0, quantity)) : 0,
        defectiveStock: stockState === 'DEFECTIVE' ? (allowNegativeStock ? quantity : Math.max(0, quantity)) : 0,
        testingStock: stockState === 'TESTING' ? (allowNegativeStock ? quantity : Math.max(0, quantity)) : 0,
        quantity: allowNegativeStock ? quantity : Math.max(0, quantity),
        minStock: product.minStock || 5,
      },
      update: {
        goodStock: prevLocGood,
        defectiveStock: prevLocDefective,
        testingStock: prevLocTesting,
        quantity: newLocTotal,
      },
    });

    // Aggregate overall product stock across all locations
    const allLocStocks = await tx.locationStock.aggregate({
      where: { businessId, productId },
      _sum: {
        quantity: true,
        goodStock: true,
        defectiveStock: true,
        testingStock: true,
      },
    });

    const totalCurrentStock = allLocStocks._sum.quantity || 0;
    const totalGoodStock = allLocStocks._sum.goodStock || 0;
    const totalDefectiveStock = allLocStocks._sum.defectiveStock || 0;
    const totalTestingStock = allLocStocks._sum.testingStock || 0;

    // Update Product Table total
    await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: totalCurrentStock,
        goodStock: totalGoodStock,
        defectiveStock: totalDefectiveStock,
        testingStock: totalTestingStock,
      },
    });

    // Create Stock Movement record
    const movement = await tx.stockMovement.create({
      data: {
        businessId,
        productId,
        toLocationId: quantity > 0 ? targetLocationId : null,
        fromLocationId: quantity < 0 ? targetLocationId : null,
        type,
        quantity,
        previousStock: product.currentStock,
        newStock: totalCurrentStock,
        stockState,
        reference,
        note: note || (newLocTotal < 0 ? '⚠ Negative Stock Transaction' : 'Stock Movement'),
        createdBy,
      },
    });

    return { movement, previousStock: product.currentStock, newStock: totalCurrentStock };
  }

  /**
   * Transfer stock between two locations atomically (Godown -> Store or Store -> Godown).
   */
  static async transferStock(
    { businessId, productId, fromLocationId, toLocationId, quantity, note, createdBy },
    tx = prisma
  ) {
    if (quantity <= 0) {
      throw new Error('Transfer quantity must be greater than 0');
    }
    if (fromLocationId === toLocationId) {
      throw new Error('Source and destination locations cannot be the same');
    }

    return await tx.$transaction(async (tr) => {
      const product = await tr.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Product not found');

      const business = await tr.business.findUnique({ where: { id: businessId } });
      const allowNegativeStock = business?.allowNegativeStock || false;

      const sourceLoc = await tr.location.findUnique({ where: { id: fromLocationId } });
      const destLoc = await tr.location.findUnique({ where: { id: toLocationId } });

      if (!sourceLoc || !destLoc) throw new Error('Source or destination location not found');

      // Check source stock
      const sourceStockRecord = await tr.locationStock.findUnique({
        where: {
          businessId_locationId_productId: {
            businessId,
            locationId: fromLocationId,
            productId,
          },
        },
      });

      const sourceAvailable = sourceStockRecord?.goodStock || 0;
      if (!allowNegativeStock && sourceAvailable < quantity) {
        throw new Error(`Only ${sourceAvailable} pieces available in ${sourceLoc.name}`);
      }

      // Deduct from source
      const newSourceGood = sourceAvailable - quantity;
      const newSourceTotal = newSourceGood + (sourceStockRecord?.defectiveStock || 0) + (sourceStockRecord?.testingStock || 0) + (sourceStockRecord?.reservedStock || 0);

      await tr.locationStock.upsert({
        where: {
          businessId_locationId_productId: {
            businessId,
            locationId: fromLocationId,
            productId,
          },
        },
        create: {
          businessId,
          locationId: fromLocationId,
          productId,
          goodStock: newSourceGood,
          quantity: newSourceTotal,
          minStock: product.minStock || 5,
        },
        update: {
          goodStock: newSourceGood,
          quantity: newSourceTotal,
        },
      });

      // Add to destination
      const destStockRecord = await tr.locationStock.findUnique({
        where: {
          businessId_locationId_productId: {
            businessId,
            locationId: toLocationId,
            productId,
          },
        },
      });

      const destPrevGood = destStockRecord?.goodStock || 0;
      const newDestGood = destPrevGood + quantity;
      const newDestTotal = newDestGood + (destStockRecord?.defectiveStock || 0) + (destStockRecord?.testingStock || 0) + (destStockRecord?.reservedStock || 0);

      await tr.locationStock.upsert({
        where: {
          businessId_locationId_productId: {
            businessId,
            locationId: toLocationId,
            productId,
          },
        },
        create: {
          businessId,
          locationId: toLocationId,
          productId,
          goodStock: quantity,
          quantity,
          minStock: product.minStock || 5,
        },
        update: {
          goodStock: newDestGood,
          quantity: newDestTotal,
        },
      });

      // Record Transfer Movement
      const movement = await tr.stockMovement.create({
        data: {
          businessId,
          productId,
          fromLocationId,
          toLocationId,
          type: 'TRANSFER',
          quantity,
          previousStock: product.currentStock,
          newStock: product.currentStock,
          previousSourceQuantity: sourceAvailable,
          newSourceQuantity: newSourceGood,
          previousDestQuantity: destPrevGood,
          newDestQuantity: newDestGood,
          reference: `TR-${Date.now().toString().slice(-6)}`,
          note: note || `Sent ${quantity} pcs from ${sourceLoc.name} to ${destLoc.name}`,
          createdBy,
        },
      });

      return {
        movement,
        sourceLocation: sourceLoc,
        destLocation: destLoc,
        sourceStockAfter: newSourceGood,
        destStockAfter: newDestGood,
      };
    });
  }

  /**
   * Bulk Allocate Stock from Godown to multiple stores.
   */
  static async bulkAllocate({ businessId, allocations, fromLocationId, createdBy }, tx = prisma) {
    const results = [];
    for (const alloc of allocations) {
      if (alloc.quantity > 0) {
        const res = await this.transferStock(
          {
            businessId,
            productId: alloc.productId,
            fromLocationId,
            toLocationId: alloc.toLocationId,
            quantity: alloc.quantity,
            note: alloc.note || 'Godown Allocation',
            createdBy,
          },
          tx
        );
        results.push(res);
      }
    }
    return results;
  }

  /**
   * Receive Stock Order (Purchase Order receipt into Godown/Location)
   * Supports partial receipt with remaining quantities calculation.
   */
  static async receiveStockOrder({ businessId, orderId, receivedItems, locationId, note, createdBy }, tx = prisma) {
    return await tx.$transaction(async (tr) => {
      const order = await tr.purchaseOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new Error('Stock Order not found');

      const targetLocId = locationId || order.locationId || (await this.getDefaultGodown(businessId, tr)).id;

      let allCompleted = true;

      for (const itemReceipt of receivedItems) {
        const orderItem = order.items.find(i => i.id === itemReceipt.itemId || i.productId === itemReceipt.productId);
        if (!orderItem) continue;

        const qtyToReceive = parseInt(itemReceipt.receivedQuantity || 0, 10);
        if (qtyToReceive <= 0) continue;

        const newReceivedTotal = orderItem.receivedQuantity + qtyToReceive;

        await tr.purchaseOrderItem.update({
          where: { id: orderItem.id },
          data: { receivedQuantity: newReceivedTotal },
        });

        if (newReceivedTotal < orderItem.quantity) {
          allCompleted = false;
        }

        // Intake stock into location
        if (orderItem.productId) {
          await this.recordMovement({
            businessId,
            productId: orderItem.productId,
            locationId: targetLocId,
            type: 'PURCHASE',
            quantity: qtyToReceive,
            stockState: 'GOOD',
            reference: `RCV-${order.poNo}`,
            note: note || `Stock Received from ${order.supplierName} (${qtyToReceive} pcs)`,
            createdBy,
          }, tr);
        }
      }

      // Update Order status
      const updatedStatus = allCompleted ? 'RECEIVED' : 'PARTIAL';
      const updatedOrder = await tr.purchaseOrder.update({
        where: { id: orderId },
        data: { status: updatedStatus },
        include: { items: true },
      });

      return updatedOrder;
    });
  }
}
