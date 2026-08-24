import express from 'express';
import prisma from '../prisma.js';

const router = express.Router();

// Get Suppliers with store-isolated Money to Pay balances
router.get('/', async (req, res) => {
  try {
    const { businessId, search, locationId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };

    if (locationId && locationId !== 'ALL') {
      where.locationId = locationId;
    }

    if (search) {
      const q = search.trim();
      const searchFilter = [
        { name: { contains: q } },
        { phone: { contains: q } },
      ];
      if (where.locationId) {
        where = {
          AND: [
            { locationId: where.locationId },
            { OR: searchFilter },
          ],
          businessId,
        };
      } else {
        where.OR = searchFilter;
      }
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        location: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(suppliers);
  } catch (err) {
    console.error('Fetch suppliers error:', err);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Get Single Supplier with Ledger (Khata)
router.get('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        ledgers: { orderBy: { createdAt: 'desc' } },
        purchases: { orderBy: { createdAt: 'desc' }, take: 50 },
        payments: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    res.json(supplier);
  } catch (err) {
    console.error('Fetch supplier khata error:', err);
    res.status(500).json({ error: 'Failed to fetch supplier details' });
  }
});

// Create Supplier (Store-specific)
router.post('/', async (req, res) => {
  try {
    const { businessId, locationId, name, phone, email, address, gstin, state, openingBalance = 0 } = req.body;

    let effectiveLocationId = locationId;
    if (!effectiveLocationId || effectiveLocationId === 'ALL') {
      const defaultStore = await prisma.location.findFirst({
        where: { businessId, type: 'STORE' },
      }) || await prisma.location.findFirst({
        where: { businessId },
      });
      if (defaultStore) effectiveLocationId = defaultStore.id;
    }

    if (!businessId || !effectiveLocationId || !name) {
      return res.status(400).json({ error: 'businessId, locationId (store ID), and Supplier Name are required' });
    }

    // Verify location exists
    const location = await prisma.location.findUnique({ where: { id: effectiveLocationId } });
    if (!location) {
      return res.status(400).json({ error: 'Invalid store locationId' });
    }

    const initialPayable = parseFloat(openingBalance || 0);

    const supplier = await prisma.supplier.create({
      data: {
        businessId,
        locationId: effectiveLocationId,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address,
        gstin,
        state: state || 'Delhi',
        moneyToPay: initialPayable,
      },
    });

    if (initialPayable > 0) {
      await prisma.supplierLedger.create({
        data: {
          businessId,
          locationId: effectiveLocationId,
          supplierId: supplier.id,
          type: 'PURCHASE',
          reference: 'OPENING_BAL',
          amount: initialPayable,
          balanceAfter: initialPayable,
          note: 'Opening Balance',
        },
      });
    }

    res.status(201).json(supplier);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A supplier with this phone number already exists in this store.' });
    }
    console.error('Create supplier error:', err);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update Supplier
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, address, gstin, state } = req.body;
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { name, phone, email, address, gstin, state },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete Supplier
router.delete('/:id', async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    console.error('Delete supplier error:', err);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

export default router;

