import express from 'express';
import prisma from '../prisma.js';

const router = express.Router();

// Get Customers with store & category isolation
router.get('/', async (req, res) => {
  try {
    const { businessId, search, locationId, categoryId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    let where = { businessId };

    if (locationId && locationId !== 'ALL') {
      where.locationId = locationId;
    }

    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }

    if (search) {
      const q = search.trim();
      const searchFilter = [
        { name: { contains: q } },
        { phone: { contains: q } },
      ];
      where = {
        ...where,
        OR: searchFilter,
      };
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        location: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(customers);
  } catch (err) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get Single Customer with Ledger (Khata)
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        ledgers: { orderBy: { createdAt: 'desc' } },
        sales: { orderBy: { createdAt: 'desc' }, take: 50 },
        payments: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json(customer);
  } catch (err) {
    console.error('Fetch customer khata error:', err);
    res.status(500).json({ error: 'Failed to fetch customer khata' });
  }
});

// Create Customer (Store & Category-specific)
router.post('/', async (req, res) => {
  try {
    const { businessId, locationId, categoryId = 'folders', name, phone, email, address, gstin, state, priceLevel = 'RETAIL', openingBalance = 0 } = req.body;

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
      return res.status(400).json({ error: 'businessId, locationId (store ID), and Customer Name are required' });
    }

    // Verify location exists
    const location = await prisma.location.findUnique({ where: { id: effectiveLocationId } });
    if (!location) {
      return res.status(400).json({ error: 'Invalid store locationId' });
    }

    const initialDue = parseFloat(openingBalance || 0);
    const resolvedCategory = (categoryId === 'batteries') ? 'batteries' : 'folders';

    const customer = await prisma.customer.create({
      data: {
        businessId,
        locationId: effectiveLocationId,
        categoryId: resolvedCategory,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address,
        gstin,
        state: state || 'Delhi',
        priceLevel: priceLevel || 'RETAIL',
        moneyToReceive: initialDue,
      },
    });

    if (initialDue > 0) {
      await prisma.customerLedger.create({
        data: {
          businessId,
          locationId: effectiveLocationId,
          customerId: customer.id,
          type: 'BILL',
          reference: 'OPENING_BAL',
          amount: initialDue,
          balanceAfter: initialDue,
          note: 'Opening Balance',
        },
      });
    }

    res.status(201).json(customer);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A customer with this phone number already exists in this store & category.' });
    }
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update Customer
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, address, gstin, state, priceLevel, categoryId } = req.body;
    const data = { name, phone, email, address, gstin, state, priceLevel };
    if (categoryId) data.categoryId = categoryId;
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete Customer
router.delete('/:id', async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
