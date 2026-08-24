import React, { useState } from 'react';
import { X, ArrowDownLeft, Wallet, CheckCircle2 } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';

export const ReceiveMoneyModal = ({
  isOpen,
  onClose,
  categoryId = 'folders',
  customers = [],
  initialCustomer = null,
  onSuccess,
}) => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, locations } = useLocation();
  const { addToast } = useToast();

  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomer?.id || '');
  const [customerName, setCustomerName] = useState(initialCustomer?.name || '');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentStore = locations?.find((l) => l.id === activeLocationId) || locations?.[0];
  const catLabel = categoryId === 'batteries' ? 'Batteries' : 'Folders';

  const handleCustomerChange = (e) => {
    const cId = e.target.value;
    setSelectedCustomerId(cId);
    const found = customers.find((c) => c.id === cId);
    if (found) {
      setCustomerName(found.name);
      if (found.moneyToReceive > 0 && !amount) {
        setAmount(found.moneyToReceive.toString());
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      addToast('Please enter a valid amount', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/money/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          locationId: activeLocationId && activeLocationId !== 'ALL' ? activeLocationId : currentStore?.id,
          categoryId,
          customerId: selectedCustomerId || null,
          customerName: customerName || 'Customer',
          amount: payAmount,
          paymentMethod,
          reference: reference || `REC-${Date.now().toString().slice(-4)}`,
          notes: notes || `Payment received for ${catLabel}`,
        }),
      });

      if (res.ok) {
        addToast(`✅ Received ₹${payAmount.toLocaleString('en-IN')} payment!`, 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.error || 'Failed to record payment', 'error');
      }
    } catch (err) {
      addToast('Error recording payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Receive Money ({catLabel})</h3>
              <p className="text-[11px] text-zinc-500 font-medium">{currentStore?.name || 'Store'} • Khata Payment Entry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Customer Selection */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Customer *</label>
            {customers && customers.length > 0 ? (
              <select
                value={selectedCustomerId}
                onChange={handleCustomerChange}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
              >
                <option value="">-- Select Customer or enter name below --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} — Due: ₹{(c.moneyToReceive || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            ) : null}
            {!selectedCustomerId && (
              <input
                type="text"
                required
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full mt-1.5 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
              />
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Amount Received (₹) *</label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-base font-extrabold text-emerald-700"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Payment Mode *</label>
            <div className="grid grid-cols-3 gap-2">
              {['CASH', 'UPI', 'BANK'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    paymentMethod === mode
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Ref / UTR #</label>
              <input
                type="text"
                placeholder="Optional"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 font-medium"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-2 px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary py-2 px-4 text-xs shadow-xs font-bold flex items-center gap-1.5"
            >
              {loading ? 'Recording...' : '💰 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
