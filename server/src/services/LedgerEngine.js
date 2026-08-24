import prisma from '../prisma.js';

export class LedgerEngine {
  /**
   * Record Customer transaction and update ledger & balance with store location context
   */
  static async recordCustomerTransaction({ businessId, locationId, customerId, type, reference, amount, note }, tx = prisma) {
    if (!customerId) return null;

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) return null;

    const targetLocationId = locationId || customer.locationId;
    if (!targetLocationId) {
      throw new Error('locationId (store ID) is required to record customer transaction');
    }

    let balanceDelta = 0;
    if (type === 'BILL') {
      balanceDelta = amount; // Customer owes more
    } else if (type === 'PAYMENT' || type === 'RETURN') {
      balanceDelta = -amount; // Customer owes less
    }

    const newBalance = Math.max(0, customer.moneyToReceive + balanceDelta);

    const ledger = await tx.customerLedger.create({
      data: {
        businessId,
        locationId: targetLocationId,
        customerId,
        type,
        reference,
        amount,
        balanceAfter: newBalance,
        note,
      },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        moneyToReceive: newBalance,
        totalSales: type === 'BILL' ? customer.totalSales + amount : customer.totalSales,
      },
    });

    return ledger;
  }

  /**
   * Record Supplier transaction and update ledger & balance with store location context
   */
  static async recordSupplierTransaction({ businessId, locationId, supplierId, type, reference, amount, note }, tx = prisma) {
    if (!supplierId) return null;

    const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return null;

    const targetLocationId = locationId || supplier.locationId;
    if (!targetLocationId) {
      throw new Error('locationId (store ID) is required to record supplier transaction');
    }

    let balanceDelta = 0;
    if (type === 'PURCHASE') {
      balanceDelta = amount; // We owe supplier more
    } else if (type === 'PAYMENT' || type === 'RETURN') {
      balanceDelta = -amount; // We owe supplier less
    }

    const newBalance = Math.max(0, supplier.moneyToPay + balanceDelta);

    const ledger = await tx.supplierLedger.create({
      data: {
        businessId,
        locationId: targetLocationId,
        supplierId,
        type,
        reference,
        amount,
        balanceAfter: newBalance,
        note,
      },
    });

    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        moneyToPay: newBalance,
        totalPurchases: type === 'PURCHASE' ? supplier.totalPurchases + amount : supplier.totalPurchases,
      },
    });

    return ledger;
  }

  /**
   * Update cash/bank/upi account balances per store location
   */
  static async updateAccountBalance({ businessId, locationId, method, amount, isIncoming }, tx = prisma) {
    const delta = isIncoming ? amount : -amount;
    const methodLower = (method || 'CASH').toLowerCase();

    let cashDelta = 0;
    let bankDelta = 0;
    let upiDelta = 0;

    if (methodLower === 'cash') cashDelta = delta;
    else if (methodLower === 'bank' || methodLower === 'card' || methodLower === 'cheque') bankDelta = delta;
    else if (methodLower === 'upi') upiDelta = delta;
    else cashDelta = delta;

    // 1. Update location-specific account balance if locationId is provided
    if (locationId && locationId !== 'ALL') {
      let locAccount = await tx.accountBalance.findFirst({
        where: { businessId, locationId },
      });

      if (!locAccount) {
        locAccount = await tx.accountBalance.create({
          data: { businessId, locationId, cashBalance: 0, bankBalance: 0, upiBalance: 0 },
        });
      }

      await tx.accountBalance.update({
        where: { id: locAccount.id },
        data: {
          cashBalance: Math.max(0, locAccount.cashBalance + cashDelta),
          bankBalance: Math.max(0, locAccount.bankBalance + bankDelta),
          upiBalance: Math.max(0, locAccount.upiBalance + upiDelta),
        },
      });
    }

    // 2. Update overall business-level account balance (where locationId is null)
    let bizAccount = await tx.accountBalance.findFirst({
      where: { businessId, locationId: null },
    });

    if (!bizAccount) {
      bizAccount = await tx.accountBalance.create({
        data: { businessId, locationId: null, cashBalance: 45000.0, bankBalance: 185000.0, upiBalance: 62400.0 },
      });
    }

    await tx.accountBalance.update({
      where: { id: bizAccount.id },
      data: {
        cashBalance: Math.max(0, bizAccount.cashBalance + cashDelta),
        bankBalance: Math.max(0, bizAccount.bankBalance + bankDelta),
        upiBalance: Math.max(0, bizAccount.upiBalance + upiDelta),
      },
    });
  }
}
