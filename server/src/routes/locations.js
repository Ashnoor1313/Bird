import express from 'express';
import prisma from '../prisma.js';
import { StockEngine } from '../services/StockEngine.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET ALL LOCATIONS FOR A BUSINESS (Auto-provisions defaults if none exist)
router.get('/', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const locations = await StockEngine.ensureDefaultLocations(businessId, prisma);
    res.json(locations);
  } catch (err) {
    console.error('Failed to fetch locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// GET SINGLE LOCATION DETAILS (WITH STOCK SUMMARY)
router.get('/:id', async (req, res) => {
  try {
    const location = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: {
        locationStocks: {
          include: { product: true },
        },
      },
    });

    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location details' });
  }
});

// CREATE NEW LOCATION (ADMIN / OWNER ONLY)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { businessId, name, type = 'STORE', address, phone, managerName } = req.body;

    if (!businessId || !name) {
      return res.status(400).json({ error: 'businessId and location name are required' });
    }

    const location = await prisma.location.create({
      data: {
        businessId,
        name: name.trim(),
        type: type.toUpperCase(),
        address: address ? address.trim() : null,
        phone: phone ? phone.trim() : null,
        managerName: managerName ? managerName.trim() : null,
        status: 'ACTIVE',
      },
    });

    // Populate common stock for all products in this new location
    await StockEngine.syncBusinessStocks(businessId);

    res.status(201).json(location);
  } catch (err) {
    console.error('Failed to create location:', err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// UPDATE LOCATION (ADMIN / OWNER ONLY)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, type, address, phone, managerName, status } = req.body;

    const updated = await prisma.location.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(type && { type: type.toUpperCase() }),
        ...(address !== undefined && { address: address ? address.trim() : null }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(managerName !== undefined && { managerName: managerName ? managerName.trim() : null }),
        ...(status && { status }),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE LOCATION (ADMIN / OWNER ONLY)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const location = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { sales: true, locationStocks: true } } },
    });

    if (!location) return res.status(404).json({ error: 'Location not found' });

    if (location.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default primary location' });
    }

    await prisma.location.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

export default router;

