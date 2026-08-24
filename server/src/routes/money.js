import express from 'express';
import prisma from '../prisma.js';
import { LedgerEngine } from '../services/LedgerEngine.js';

const router = express.Router();

// Get account balances & recent transactions (filtered by locationId and categoryId if provided)
router.get('/balances', async (req, res) => {
  try {
    const { businessId, locationId, categoryId } = req.query;
    let business = businessId ? await prisma.business.findUnique({ where: { id: businessId } }) : null;
    if (!business) {
      business = await prisma.business.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    if (!business) {
      business = await prisma.business.create({
        data: {
          name: 'MI2 Impex',
          state: 'Delhi',
          billPrefix: 'MI2',
          startingBillNo: 1001,
        },
      });
    }
    const resolvedBusinessId = business.id;

    const isStoreScoped = locationId && locationId !== 'ALL';
    let balance = await prisma.accountBalance.findFirst({
      where: {
        businessId: resolvedBusinessId,
        locationId: isStoreScoped ? locationId : null,
      },
    });

    if (!balance) {
      balance = await prisma.accountBalance.create({
        data: {
          businessId: resolvedBusinessId,
          locationId: isStoreScoped ? locationId : null,
          cashBalance: isStoreScoped ? 0.0 : 45000.0,
          bankBalance: isStoreScoped ? 0.0 : 185000.0,
          upiBalance: isStoreScoped ? 0.0 : 62400.0,
        },
      });
    }

    let paymentWhere = { businessId: resolvedBusinessId };
    let expenseWhere = { businessId: resolvedBusinessId };

    if (isStoreScoped) {
      paymentWhere.locationId = locationId;
      expenseWhere.locationId = locationId;
    }

    if (categoryId && categoryId !== 'ALL') {
      paymentWhere.categoryId = categoryId;
      expenseWhere.OR = [
        { categoryId: categoryId },
        { categoryId: null }, // General store expenses apply to both categories
      ];
    }

    const recentPayments = await prisma.payment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const recentExpenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const totalBalance = (balance.cashBalance || 0) + (balance.bankBalance || 0) + (balance.upiBalance || 0);
    const totalExpenses = recentExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalReceived = recentPayments.filter(p => p.type === 'RECEIVE').reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalPaid = recentPayments.filter(p => p.type === 'PAY').reduce((acc, p) => acc + (p.amount || 0), 0);

    res.json({
      balance,
      totalBalance,
      totalExpenses,
      totalReceived,
      totalPaid,
      payments: recentPayments,
      expenses: recentExpenses,
    });
  } catch (err) {
    console.error('Money balances error:', err);
    res.status(500).json({ error: 'Failed to fetch money balances', message: err.message });
  }
});

// RECEIVE MONEY (From Customer - Scoped to Category & Location)
router.post('/receive', async (req, res) => {
  try {
    const { businessId, locationId, categoryId = 'folders', customerId, customerName, amount, paymentMethod = 'CASH', reference, notes } = req.body;

    let effectiveLocationId = locationId;
    if (!effectiveLocationId || effectiveLocationId === 'ALL') {
      const defaultStore = await prisma.location.findFirst({
        where: { businessId, type: 'STORE' },
      }) || await prisma.location.findFirst({
        where: { businessId },
      });
      if (defaultStore) effectiveLocationId = defaultStore.id;
    }

    if (!businessId || !effectiveLocationId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'businessId, locationId (store ID), and valid amount are required' });
    }

    const resolvedLocationId = effectiveLocationId;
    const resolvedCategory = categoryId === 'batteries' ? 'batteries' : 'folders';

    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(400).json({ error: 'Customer not found' });
      }
      if (customer.locationId !== resolvedLocationId) {
        return res.status(400).json({ error: 'Customer belongs to a different store' });
      }
    }

    const payAmount = parseFloat(amount);

    const payment = await prisma.$transaction(async (tx) => {
      // Create Payment Record
      const p = await tx.payment.create({
        data: {
          businessId,
          locationId: resolvedLocationId,
          categoryId: resolvedCategory,
          type: 'RECEIVE',
          partyType: 'CUSTOMER',
          customerId: customerId || null,
          partyName: customerName || 'Customer',
          amount: payAmount,
          paymentMethod,
          reference,
          notes,
        },
      });

      // Update Customer Khata
      if (customerId) {
        await LedgerEngine.recordCustomerTransaction(
          {
            businessId,
            locationId: resolvedLocationId,
            customerId,
            type: 'PAYMENT',
            reference: reference || `REC-${Date.now().toString().slice(-4)}`,
            amount: payAmount,
            note: notes || 'Money received from customer',
          },
          tx
        );
      }

      // Update Cash/Bank/UPI Balance for this store location
      await LedgerEngine.updateAccountBalance({ businessId, locationId: resolvedLocationId, method: paymentMethod, amount: payAmount, isIncoming: true }, tx);

      return p;
    });

    res.status(201).json(payment);
  } catch (err) {
    console.error('Receive money error:', err);
    res.status(500).json({ error: 'Failed to record received payment' });
  }
});

// PAY MONEY (To Supplier)
router.post('/pay', async (req, res) => {
  try {
    const { businessId, locationId, categoryId = 'folders', supplierId, supplierName, amount, paymentMethod = 'CASH', reference, notes } = req.body;

    let effectiveLocationId = locationId;
    if (!effectiveLocationId || effectiveLocationId === 'ALL') {
      const defaultStore = await prisma.location.findFirst({
        where: { businessId, type: 'STORE' },
      }) || await prisma.location.findFirst({
        where: { businessId },
      });
      if (defaultStore) effectiveLocationId = defaultStore.id;
    }

    if (!businessId || !effectiveLocationId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'businessId, locationId (store ID), and valid amount are required' });
    }

    const resolvedLocationId = effectiveLocationId;
    const resolvedCategory = categoryId === 'batteries' ? 'batteries' : 'folders';

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return res.status(400).json({ error: 'Supplier not found' });
      }
      if (supplier.locationId !== resolvedLocationId) {
        return res.status(400).json({ error: 'Supplier belongs to a different store' });
      }
    }

    const payAmount = parseFloat(amount);

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          businessId,
          locationId: resolvedLocationId,
          categoryId: resolvedCategory,
          type: 'PAY',
          partyType: 'SUPPLIER',
          supplierId: supplierId || null,
          partyName: supplierName || 'Supplier',
          amount: payAmount,
          paymentMethod,
          reference,
          notes,
        },
      });

      // Update Supplier Khata
      if (supplierId) {
        await LedgerEngine.recordSupplierTransaction(
          {
            businessId,
            locationId: resolvedLocationId,
            supplierId,
            type: 'PAYMENT',
            reference: reference || `PAY-${Date.now().toString().slice(-4)}`,
            amount: payAmount,
            note: notes || 'Money paid to supplier',
          },
          tx
        );
      }

      // Deduct Cash/Bank/UPI Balance for this store location
      await LedgerEngine.updateAccountBalance({ businessId, locationId: resolvedLocationId, method: paymentMethod, amount: payAmount, isIncoming: false }, tx);

      return p;
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payout' });
  }
});

// ADD EXPENSE (Category-specific or general store expense)
router.post('/expenses', async (req, res) => {
  try {
    const { businessId, locationId, categoryId, category, amount, paidFrom = 'CASH', notes } = req.body;

    let effectiveLocationId = locationId;
    if (!effectiveLocationId || effectiveLocationId === 'ALL') {
      const defaultStore = await prisma.location.findFirst({
        where: { businessId, type: 'STORE' },
      }) || await prisma.location.findFirst({
        where: { businessId },
      });
      if (defaultStore) effectiveLocationId = defaultStore.id;
    }

    if (!businessId || !effectiveLocationId || !category || !amount) {
      return res.status(400).json({ error: 'businessId, locationId (store ID), category, and amount required' });
    }

    const resolvedLocationId = effectiveLocationId;
    const expAmount = parseFloat(amount);

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          businessId,
          locationId: resolvedLocationId,
          categoryId: categoryId || null,
          category,
          amount: expAmount,
          paidFrom,
          notes,
        },
      });

      // Deduct Cash/Bank balance for this store location
      await LedgerEngine.updateAccountBalance({ businessId, locationId: resolvedLocationId, method: paidFrom, amount: expAmount, isIncoming: false }, tx);

      return exp;
    });

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// DELETE PAYMENT (Store-isolated unique payment deletion)
router.delete('/payments/:id', async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Reverse account balance adjustment for payment method for this store location
      const isIncomingReverse = payment.type !== 'RECEIVE'; // If it was receive, deleting it decreases balance
      await LedgerEngine.updateAccountBalance(
        { businessId: payment.businessId, locationId: payment.locationId, method: payment.paymentMethod, amount: payment.amount, isIncoming: isIncomingReverse },
        tx
      );

      // Delete payment record
      await tx.payment.delete({
        where: { id: payment.id },
      });
    });

    res.json({ message: 'Payment entry deleted successfully from store' });
  } catch (err) {
    console.error('Delete payment error:', err);
    res.status(500).json({ error: 'Failed to delete payment entry' });
  }
});

// DELETE EXPENSE (Store-isolated unique expense deletion)
router.delete('/expenses/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense record not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Reverse account balance adjustment (adding back the expense amount)
      await LedgerEngine.updateAccountBalance(
        { businessId: expense.businessId, locationId: expense.locationId, method: expense.paidFrom || 'CASH', amount: expense.amount, isIncoming: true },
        tx
      );

      // Delete expense record
      await tx.expense.delete({
        where: { id: expense.id },
      });
    });

    res.json({ message: 'Expense entry deleted successfully' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense entry' });
  }
});

export default router;
