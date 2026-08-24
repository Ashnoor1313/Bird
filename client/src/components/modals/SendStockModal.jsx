import React, { useState } from 'react';
import { X, ArrowRightLeft, Boxes, CheckCircle2 } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';

export const SendStockModal = ({
  isOpen,
  onClose,
  products = [],
  initialProduct = null,
  onSuccess,
}) => {
  const { activeBusinessId } = useBusiness();
  const { locations, activeLocationId } = useLocation();
  const { addToast } = useToast();

  const defaultGodown = locations?.find((l) => l.type === 'GODOWN') || locations?.[0];
  const defaultStore = locations?.find((l) => l.type === 'STORE') || locations?.[1] || locations?.[0];

  const [fromLocId, setFromLocId] = useState(
    activeLocationId && activeLocationId !== 'ALL' ? activeLocationId : defaultGodown?.id || ''
  );
  const [toLocId, setToLocId] = useState(defaultStore?.id || '');
  const [selectedProductId, setSelectedProductId] = useState(initialProduct?.id || products?.[0]?.id || '');
  const [quantity, setQuantity] = useState('10');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const selectedProd = products.find((p) => p.id === selectedProductId) || initialProduct;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      addToast('Please select a product', 'error');
      return;
    }
    if (fromLocId === toLocId) {
      addToast('Source and destination cannot be the same location', 'error');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      addToast('Please enter a valid transfer quantity', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          productId: selectedProductId,
          fromLocationId: fromLocId,
          toLocationId: toLocId,
          quantity: qty,
          note: note || `Stock transfer of ${qty} pcs`,
        }),
      });

      if (res.ok) {
        const fromName = locations.find((l) => l.id === fromLocId)?.name || 'Source';
        const toName = locations.find((l) => l.id === toLocId)?.name || 'Destination';
        addToast(`⚡ Transferred ${qty} pcs from ${fromName} to ${toName}!`, 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.error || 'Failed to transfer stock', 'error');
      }
    } catch (err) {
      addToast('Error transferring stock', 'error');
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
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Send Stock</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Move inventory between Godown and Stores</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* From -> To Locations */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">From *</label>
              <select
                value={fromLocId}
                onChange={(e) => setFromLocId(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800"
              >
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.type === 'GODOWN' ? '🏭' : '🏪'} {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">To *</label>
              <select
                value={toLocId}
                onChange={(e) => setToLocId(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800"
              >
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.type === 'GODOWN' ? '🏭' : '🏪'} {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Selector */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Product Model *</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
            >
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currentStock ?? 0} pcs in Godown)
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Quantity (pcs) *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-extrabold text-zinc-900"
            />
          </div>

          {/* Optional Note */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Morning store restock"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 font-medium"
            />
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
              {loading ? 'Sending...' : '⚡ Send Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
