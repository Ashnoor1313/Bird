import express from 'express';
import prisma from '../prisma.js';

const router = express.Router();

// Get list of all businesses
router.get('/', async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// Get business details by ID
router.get('/:id', async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: {
        accountBalance: true,
      },
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(business);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch business details' });
  }
});

// Create a new business
router.post('/', async (req, res) => {
  try {
    const { name, address, phone, email, gstin, state, billPrefix } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    const newBusiness = await prisma.business.create({
      data: {
        name: name.trim(),
        address,
        phone,
        email,
        gstin,
        state: state || 'Delhi',
        billPrefix: billPrefix || 'BIRD',
        startingBillNo: 1001,
        accountBalance: {
          create: {
            cashBalance: 0,
            bankBalance: 0,
            upiBalance: 0,
          },
        },
      },
      include: {
        accountBalance: true,
      },
    });

    // Default categories for new business
    const defaultCategories = [
      'Displays / LCDs',
      'Folders / Housings',
      'Batteries',
      'Charging Ports & Flex',
      'Cameras & Flex',
      'ICs & Chips',
      'Speakers & Mics',
      'Buttons & Small Parts',
      'Accessories & Tools',
    ];

    for (const catName of defaultCategories) {
      await prisma.category.create({
        data: {
          businessId: newBusiness.id,
          name: catName,
        },
      });
    }

    res.status(201).json(newBusiness);
  } catch (err) {
    console.error('Create Business Error:', err);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// Update business settings
router.put('/:id', async (req, res) => {
  try {
    const { name, address, phone, email, gstin, state, billPrefix, bankName, accountNo, ifscCode, upiId, terms, allowNegativeStock } = req.body;

    const updated = await prisma.business.update({
      where: { id: req.params.id },
      data: {
        name,
        address,
        phone,
        email,
        gstin,
        state,
        billPrefix,
        bankName,
        accountNo,
        ifscCode,
        upiId,
        terms,
        allowNegativeStock: allowNegativeStock !== undefined ? Boolean(allowNegativeStock) : undefined,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update business settings' });
  }
});

export default router;
