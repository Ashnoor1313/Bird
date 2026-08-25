import prisma from '../prisma.js';

export class StockEngine {
  /**
   * Ensure default locations exist for a business (Godown, Store 1, Store 2).
   * Migrates and synchronizes product stock across all locations (common inventory).
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
    }

    // Synchronize all products to all active locations (Common Inventory)
    const products = await tx.product.findMany({ where: { businessId, status: 'ACTIVE' } });
    for (const p of products) {
      const totalQty = p.currentStock || 0;
      const goodQty = p.goodStock !== undefined && p.goodStock !== null ? p.goodStock : totalQty;
      const defQty = p.defectiveStock || 0;
      const testQty = p.testingStock || 0;

      for (const loc of locations) {
        await tx.locationStock.upsert({
          where: {
            businessId_locationId_productId: {
              businessId,
              locationId: loc.id,
              productId: p.id,
            },
          },
          create: {
            businessId,
            locationId: loc.id,
            productId: p.id,
            goodStock: goodQty,
            defectiveStock: defQty,
            testingStock: testQty,
            quantity: totalQty,
            minStock: p.minStock || 5,
          },
          update: {
            goodStock: goodQty,
            defectiveStock: defQty,
            testingStock: testQty,
            quantity: totalQty,
          },
        });
      }
    }

    return locations;
  }

  /**
   * Synchronize all locations' LocationStock for a whole business to match Product.currentStock.
   */
  static async syncBusinessStocks(businessId, tx = prisma) {
    if (!businessId) return;
    const locations = await tx.location.findMany({
      where: { businessId },
    });
    if (locations.length === 0) {
      return await this.ensureDefaultLocations(businessId, tx);
    }

    const products = await tx.product.findMany({
      where: { businessId, status: 'ACTIVE' },
    });

    for (const p of products) {
      const totalQty = p.currentStock || 0;
      const goodQty = p.goodStock !== undefined && p.goodStock !== null ? p.goodStock : totalQty;
      const defQty = p.defectiveStock || 0;
      const testQty = p.testingStock || 0;

      for (const loc of locations) {
        await tx.locationStock.upsert({
          where: {
            businessId_locationId_productId: {
              businessId,
              locationId: loc.id,
              productId: p.id,
            },
          },
          create: {
            businessId,
            locationId: loc.id,
            productId: p.id,
            goodStock: goodQty,
            defectiveStock: defQty,
            testingStock: testQty,
            quantity: totalQty,
            minStock: p.minStock || 5,
          },
          update: {
            goodStock: goodQty,
            defectiveStock: defQty,
            testingStock: testQty,
            quantity: totalQty,
          },
        });
      }
    }
  }

  /**
   * Synchronize single product stock across all locations of the business.
   */
  static async syncProductLocationStocks(businessId, productId, tx = prisma) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) return;

    let locations = await tx.location.findMany({
      where: { businessId },
    });
    if (locations.length === 0) {
      locations = await this.ensureDefaultLocations(businessId, tx);
    }

    const totalQty = product.currentStock || 0;
    const goodQty = product.goodStock !== undefined && product.goodStock !== null ? product.goodStock : totalQty;
    const defQty = product.defectiveStock || 0;
    const testQty = product.testingStock || 0;

    for (const loc of locations) {
      await tx.locationStock.upsert({
        where: {
          businessId_locationId_productId: {
            businessId,
            locationId: loc.id,
            productId,
          },
        },
        create: {
          businessId,
          locationId: loc.id,
          productId,
          goodStock: goodQty,
          defectiveStock: defQty,
          testingStock: testQty,
          quantity: totalQty,
          minStock: product.minStock || 5,
        },
        update: {
          goodStock: goodQty,
          defectiveStock: defQty,
          testingStock: testQty,
          quantity: totalQty,
        },
      });
    }
  }

  /**
   * Get default Godown for a business.
   */
  static async getDefaultGodown(businessId, tx = prisma) {
    const locations = await this.ensureDefaultLocations(businessId, tx);
    return locations.find(l => l.type === 'GODOWN' || l.isDefault) || locations[0];
  }

  /**
   * Get stock quantity for a specific product and location (reflects common inventory).
   */
  static async getLocationStock(businessId, locationId, productId, tx = prisma) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      return { goodStock: 0, defectiveStock: 0, testingStock: 0, reservedStock: 0, quantity: 0, minStock: 5 };
    }
    const totalQty = product.currentStock || 0;
    const goodQty = product.goodStock !== undefined && product.goodStock !== null ? product.goodStock : totalQty;
    return {
      goodStock: goodQty,
      defectiveStock: product.defectiveStock || 0,
      testingStock: product.testingStock || 0,
      reservedStock: 0,
      quantity: totalQty,
      minStock: product.minStock || 5,
    };
  }

  /**
   * Record a stock movement and update common stock across all locations (Godown, Store 1, Store 2).
   * As soon as a bill is created or new stock is added, the stock updates everywhere in real-time.
   */
  static async recordMovement(
    { businessId, productId, locationId, categoryId, type, quantity, stockState = 'GOOD', reference, note, createdBy },
    tx = prisma
  ) {
    const business = await tx.business.findUnique({ where: { id: businessId } });
    const allowNegativeStock = business?.allowNegativeStock ?? true;

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    let prevGood = product.goodStock !== undefined && product.goodStock !== null ? product.goodStock : (product.currentStock || 0);
    let prevDefective = product.defectiveStock || 0;
    let prevTesting = product.testingStock || 0;

    if (stockState === 'GOOD') {
      prevGood = prevGood + quantity;
    } else if (stockState === 'DEFECTIVE') {
      prevDefective = prevDefective + quantity;
    } else if (stockState === 'TESTING') {
      prevTesting = prevTesting + quantity;
    }

    const newProductTotal = prevGood + prevDefective + prevTesting;

    // 1. Update Product table total
    await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: newProductTotal,
        goodStock: prevGood,
        defectiveStock: prevDefective,
        testingStock: prevTesting,
      },
    });

    // 2. Ensure active locations exist (Godown, Store 1, Store 2)
    let locations = await tx.location.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
    if (locations.length === 0) {
      locations = await this.ensureDefaultLocations(businessId, tx);
    }

    // 3. Synchronize LocationStock for ALL locations (Godown, Store 1, Store 2) with the common stock
    for (const loc of locations) {
      await tx.locationStock.upsert({
        where: {
          businessId_locationId_productId: {
            businessId,
            locationId: loc.id,
            productId,
          },
        },
        create: {
          businessId,
          locationId: loc.id,
          productId,
          goodStock: prevGood,
          defectiveStock: prevDefective,
          testingStock: prevTesting,
          quantity: newProductTotal,
          minStock: product.minStock || 5,
        },
        update: {
          goodStock: prevGood,
          defectiveStock: prevDefective,
          testingStock: prevTesting,
          quantity: newProductTotal,
        },
      });
    }

    // 4. Create Stock Movement audit record
    const movement = await tx.stockMovement.create({
      data: {
        businessId,
        productId,
        categoryId: categoryId || product.categoryId || (product.partType === 'Battery' ? 'batteries' : 'folders'),
        toLocationId: quantity > 0 ? (locationId || locations[0]?.id) : null,
        fromLocationId: quantity < 0 ? (locationId || locations[0]?.id) : null,
        type,
        quantity,
        previousStock: product.currentStock,
        newStock: newProductTotal,
        stockState,
        reference,
        note: note || (newProductTotal < 0 ? '⚠ Negative Stock Transaction' : 'Stock Movement'),
        createdBy,
      },
    });

    return { movement, previousStock: product.currentStock, newStock: newProductTotal };
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
