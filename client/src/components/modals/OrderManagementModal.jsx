import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, FileText, ShoppingBag, Truck } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';

export const OrderManagementModal = ({ isOpen, onClose, initialType = 'QUOTATION', onCreated }) => {
  if (!isOpen) return null;

  const { activeBusinessId } = useBusiness();
  const { addToast } = useToast();

  const [type, setType] = useState(initialType); // QUOTATION, SALES_ORDER, DELIVERY_CHALLAN, PURCHASE_ORDER
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPartiesAndProducts();
  }, [activeBusinessId]);

  const fetchPartiesAndProducts = async () => {
    try {
      const [custRes, suppRes, prodRes] = await Promise.all([
        fetch(`/api/customers?businessId=${activeBusinessId}`),
        fetch(`/api/suppliers?businessId=${activeBusinessId}`),
        fetch(`/api/products?businessId=${activeBusinessId}`),
      ]);
      if (custRes.ok) setCustomers(await custRes.json());
      if (suppRes.ok) setSuppliers(await suppRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (err) {
      console.error('Failed to load modal data:', err);
    }
  };

  const handlePartySelect = (id) => {
    setSelectedPartyId(id);
    if (type === 'PURCHASE_ORDER') {
      const supp = suppliers.find(s => s.id === id);
      if (supp) {
        setPartyName(supp.name);
        setPartyPhone(supp.phone || '');
      }
    } else {
      const cust = customers.find(c => c.id === id);
      if (cust) {
        setPartyName(cust.name);
        setPartyPhone(cust.phone || '');
      }
    }
  };

  const addItemRow = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    setItems([
      ...items,
      {
        productId: firstProd.id,
        productName: firstProd.name,
        model: firstProd.model || '',
        quality: firstProd.quality || 'OEM',
        variant: firstProd.variant || '',
        quantity: 1,
        unitPrice: firstProd.sellingPrice || 0,
        discount: 0,
        gstPercentage: firstProd.gstPercentage || 18,
      },
    ]);
  };

  const removeItemRow = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx, field, val) => {
    const copy = [...items];
    copy[idx][field] = val;
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) {
        copy[idx].productName = prod.name;
        copy[idx].model = prod.model || '';
        copy[idx].quality = prod.quality || 'OEM';
        copy[idx].variant = prod.variant || '';
        copy[idx].unitPrice = type === 'PURCHASE_ORDER' ? prod.purchasePrice : prod.sellingPrice;
      }
    }
    setItems(copy);
  };

  const subtotal = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice - (i.discount || 0)), 0);
  const grandTotal = Math.max(0, subtotal - parseFloat(discount || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!partyName || items.length === 0) {
      addToast('Please select party and add at least 1 item', 'warning');
      return;
    }

    setLoading(true);
    try {
      let endpoint = '/api/orders/quotations';
      let payload = {
        businessId: activeBusinessId,
        customerId: type !== 'PURCHASE_ORDER' ? selectedPartyId : null,
        supplierId: type === 'PURCHASE_ORDER' ? selectedPartyId : null,
        customerName: partyName,
        supplierName: partyName,
        customerPhone: partyPhone,
        items,
        discount: parseFloat(discount || 0),
        notes,
      };

      if (type === 'DELIVERY_CHALLAN') endpoint = '/api/orders/delivery-challans';
      if (type === 'PURCHASE_ORDER') endpoint = '/api/orders/purchase-orders';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        addToast(`${type.replace('_', ' ')} created successfully!`, 'success');
        if (onCreated) onCreated();
        onClose();
      } else {
        addToast('Failed to create document', 'error');
      }
    } catch (err) {
      addToast('Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            {type === 'QUOTATION' && <FileText className="w-5 h-5 text-amber-400" />}
            {type === 'SALES_ORDER' && <ShoppingBag className="w-5 h-5 text-emerald-400" />}
            {type === 'DELIVERY_CHALLAN' && <Truck className="w-5 h-5 text-sky-400" />}
            {type === 'PURCHASE_ORDER' && <ShoppingBag className="w-5 h-5 text-indigo-400" />}
            <span className="font-extrabold text-base text-white">Create New {type.replace('_', ' ')}</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="grid grid-cols-4 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'QUOTATION', label: 'Quotation / Estimate' },
            { id: 'SALES_ORDER', label: 'Sales Order' },
            { id: 'DELIVERY_CHALLAN', label: 'Delivery Challan' },
            { id: 'PURCHASE_ORDER', label: 'Purchase Order' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`py-2 px-3 rounded-lg font-bold text-center transition-colors ${
                type === t.id ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Party Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {type === 'PURCHASE_ORDER' ? 'Supplier Name' : 'Customer Name'}
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => handlePartySelect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
              >
                <option value="">-- Select {type === 'PURCHASE_ORDER' ? 'Supplier' : 'Customer'} --</option>
                {(type === 'PURCHASE_ORDER' ? suppliers : customers).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.phone || 'No phone'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Contact Phone</label>
              <input
                type="text"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                placeholder="+91 Phone number"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Line Items</span>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Part
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-6 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-500">
                No items added yet. Click "+ Add Part" to start adding spare parts.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3 text-xs">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItemRow(idx, 'productId', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — ₹{type === 'PURCHASE_ORDER' ? p.purchasePrice : p.sellingPrice}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value || 1, 10))}
                        placeholder="Qty"
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg p-2 text-center text-slate-200"
                      />

                      {type !== 'DELIVERY_CHALLAN' && (
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItemRow(idx, 'unitPrice', parseFloat(e.target.value || 0))}
                          placeholder="Price"
                          className="w-24 bg-slate-900 border border-slate-800 rounded-lg p-2 text-right text-slate-200"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-2 text-rose-400 hover:bg-rose-950/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtotals & Notes */}
          {type !== 'DELIVERY_CHALLAN' && (
            <div className="flex justify-between items-end pt-2 border-t border-slate-800 text-xs">
              <div className="w-1/2">
                <label className="block font-semibold text-slate-400 mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional delivery instructions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200"
                />
              </div>

              <div className="text-right space-y-1">
                <div className="text-slate-400">Subtotal: <span className="font-bold text-white">₹{subtotal.toLocaleString('en-IN')}</span></div>
                <div className="font-extrabold text-sky-400 text-base">Grand Total: ₹{grandTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-600/30"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Saving...' : `Create ${type.replace('_', ' ')}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
