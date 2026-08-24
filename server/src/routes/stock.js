import express from 'express';
import prisma from '../prisma.js';
import { StockEngine } from '../services/StockEngine.js';

const router = express.Router();

// Manual stock adjustment (+/- quantity)
router.post('/adjust', async (req, res) => {
  try {
    const { businessId, productId, locationId, type, quantity, stockState, note } = req.body;

    if (!businessId || !productId || quantity === undefined) {
      return res.status(400).json({ error: 'businessId, productId, and quantity required' });
    }

    const qty = parseInt(quantity, 10);
    const adjustmentType = type || (qty > 0 ? 'MANUAL_ADJUSTMENT' : 'DAMAGED');

    const result = await StockEngine.recordMovement({
      businessId,
      productId,
      locationId,
      type: adjustmentType,
      quantity: qty,
      stockState: stockState || 'GOOD',
      reference: 'MANUAL_ADJ',
      note: note || 'Manual inventory stock adjustment',
    });

    res.json(result);
  } catch (err) {
    console.error('Stock adjustment error:', err);
    res.status(500).json({ error: err.message || 'Failed to adjust stock' });
  }
});

// MOVE / TRANSFER STOCK BETWEEN LOCATIONS
router.post('/transfer', async (req, res) => {
  try {
    const { businessId, productId, fromLocationId, toLocationId, quantity, note, createdBy } = req.body;

    if (!businessId || !productId || !fromLocationId || !toLocationId || !quantity) {
      return res.status(400).json({ error: 'businessId, productId, fromLocationId, toLocationId, and quantity are required' });
    }

    const result = await StockEngine.transferStock({
      businessId,
      productId,
      fromLocationId,
      toLocationId,
      quantity: parseInt(quantity, 10),
      note,
      createdBy,
    });

    res.json({
      message: 'Stock moved successfully',
      result,
    });
  } catch (err) {
    console.error('Stock transfer error:', err);
    res.status(400).json({ error: err.message || 'Failed to transfer stock' });
  }
});

// BULK / SINGLE ALLOCATE STOCK FROM GODOWN TO STORES
router.post('/allocate', async (req, res) => {
  try {
    const { businessId, fromLocationId, allocations, createdBy } = req.body;
    // allocations: [{ productId, toLocationId, quantity, note }]

    if (!businessId || !allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'businessId and non-empty allocations array are required' });
    }

    let sourceLocId = fromLocationId;
    if (!sourceLocId) {
      const defaultGodown = await StockEngine.getDefaultGodown(businessId, prisma);
      sourceLocId = defaultGodown.id;
    }

    const results = await StockEngine.bulkAllocate({
      businessId,
      allocations,
      fromLocationId: sourceLocId,
      createdBy,
    });

    res.json({
      message: `Successfully allocated stock for ${results.length} item(s)`,
      results,
    });
  } catch (err) {
    console.error('Stock allocation error:', err);
    res.status(400).json({ error: err.message || 'Failed to allocate stock' });
  }
});

// GET STOCK DISTRIBUTION FOR A PRODUCT ACROSS ALL LOCATIONS
router.get('/distribution', async (req, res) => {
  try {
    const { businessId, productId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const locations = await StockEngine.ensureDefaultLocations(businessId, prisma);

    let where = { businessId };
    if (productId) where.productId = productId;

    const locStocks = await prisma.locationStock.findMany({
      where,
      include: {
        location: true,
        product: true,
      },
    });

    res.json({
      locations,
      locationStocks: locStocks,
    });
  } catch (err) {
    console.error('Stock distribution fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch stock distribution' });
  }
});

// GET STOCK MOVEMENTS & TRANSFERS TIMELINE
router.get('/movements', async (req, res) => {
  try {
    const { businessId, type, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };
    if (type) where.type = type;
    if (locationId) {
      where.OR = [
        { fromLocationId: locationId },
        { toLocationId: locationId },
      ];
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

export default router;
