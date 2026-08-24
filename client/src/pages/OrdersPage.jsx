import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  ShoppingBag,
  Plus,
  Boxes,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Calendar,
  Truck,
  PackageCheck,
  X,
  ChevronRight,
} from 'lucide-react';

export const OrdersPage = () => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation } = useLocation();
  const { addToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ORDERED' | 'RECEIVED'

  // New Order Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [orderItems, setOrderItems] = useState([
    { productName: '', quantity: '50', unitPrice: '' },
  ]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Receive Stock Modal State
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receiveInputs, setReceiveInputs] = useState({}); // { itemId: quantityToReceive }
  const [receivingLoading, setReceivingLoading] = useState(false);

  useEffect(() => {
    if (activeBusinessId) {
      fetchOrders();
    }
  }, [activeBusinessId, activeLocationId, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/api/orders/stock-orders?businessId=${activeBusinessId}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (activeLocationId && activeLocationId !== 'ALL') url += `&locationId=${activeLocationId}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load stock orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItemRow = () => {
    setOrderItems([...orderItems, { productName: '', quantity: '50', unitPrice: '' }]);
  };

  const handleUpdateItemRow = (idx, field, val) => {
    const updated = [...orderItems];
    updated[idx][field] = val;
    setOrderItems(updated);
  };

  const handleRemoveItemRow = (idx) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const handleCreateStockOrder = async (e) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      addToast('Supplier name is required', 'error');
      return;
    }

    const validItems = orderItems.filter(i => i.productName.trim() && parseInt(i.quantity, 10) > 0);
    if (validItems.length === 0) {
      addToast('Please enter at least one item with valid quantity', 'error');
      return;
    }

    setCreatingOrder(true);
    try {
      const res = await fetch('/api/orders/stock-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          locationId: activeLocationId && activeLocationId !== 'ALL' ? activeLocationId : undefined,
          supplierName: supplierName.trim(),
          expectedDate: expectedDate || undefined,
          items: validItems,
        }),
      });

      if (res.ok) {
        addToast('Stock order recorded successfully!', 'success');
        setShowCreateModal(false);
        setSupplierName('');
        setExpectedDate('');
        setOrderItems([{ productName: '', quantity: '50', unitPrice: '' }]);
        fetchOrders();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to create stock order', 'error');
      }
    } catch (err) {
      addToast('Error creating stock order', 'error');
    } finally {
      setCreatingOrder(false);
    }
  };

  const openReceiveModal = (order) => {
    setReceivingOrder(order);
    const initialInputs = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - (item.receivedQuantity || 0));
      initialInputs[item.id] = remaining.toString();
    });
    setReceiveInputs(initialInputs);
  };

  const handleConfirmReceiveStock = async (e) => {
    e.preventDefault();
    if (!receivingOrder) return;

    const receivedPayload = [];
    for (const item of receivingOrder.items) {
      const qty = parseInt(receiveInputs[item.id] || '0', 10);
      if (qty > 0) {
        receivedPayload.push({
          itemId: item.id,
          productId: item.productId,
          receivedQuantity: qty,
        });
      }
    }

    if (receivedPayload.length === 0) {
      addToast('Please enter received quantity for at least one item', 'error');
      return;
    }

    setReceivingLoading(true);
    try {
      const res = await fetch('/api/orders/stock-orders/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          orderId: receivingOrder.id,
          locationId: activeLocationId && activeLocationId !== 'ALL' ? activeLocationId : undefined,
          receivedItems: receivedPayload,
        }),
      });

      if (res.ok) {
        addToast('Stock intake confirmed and added to Godown inventory!', 'success');
        setReceivingOrder(null);
        fetchOrders();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to receive stock', 'error');
      }
    } catch (err) {
      addToast('Failed to receive stock order', 'error');
    } finally {
      setReceivingLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.poNo?.toLowerCase().includes(q) ||
      o.supplierName?.toLowerCase().includes(q) ||
      o.items?.some(i => i.productName?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-zinc-700" />
            <span>Supplier Stock Orders</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">Record and track pending vs received wholesale purchase orders.</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Order Stock</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex items-center bg-zinc-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'ALL' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All Orders
          </button>
          <button
            onClick={() => setStatusFilter('ORDERED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'ORDERED' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Ordered / Pending
          </button>
          <button
            onClick={() => setStatusFilter('RECEIVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'RECEIVED' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Received
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier, PO number, or product..."
            className="w-full pl-9 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Loading stock orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-2xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">No stock orders found</h3>
          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
            Record items you ordered from wholesale suppliers to track pending vs delivered quantities.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Stock Order</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isCompleted = order.status === 'RECEIVED';
            const totalOrdered = order.items.reduce((s, i) => s + i.quantity, 0);
            const totalReceived = order.items.reduce((s, i) => s + (i.receivedQuantity || 0), 0);
            const remaining = Math.max(0, totalOrdered - totalReceived);

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:border-blue-300 transition-all"
              >
                {/* Order Top Header */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">{order.poNo}</span>
                      {isCompleted ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🟢 Fully Received
                        </span>
                      ) : totalReceived > 0 ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          🟡 Partially Received ({totalReceived}/{totalOrdered})
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                          🔵 Stock Ordered ({totalOrdered} pcs)
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900">{order.supplierName}</h3>
                  </div>

                  {!isCompleted && (
                    <button
                      onClick={() => openReceiveModal(order)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Receive Stock</span>
                    </button>
                  )}
                </div>

                {/* Items Breakdown Table */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 text-xs">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 border-b border-slate-200/50 last:border-0 pb-1.5 last:pb-0">
                      <span className="font-bold text-slate-800 truncate">{item.productName}</span>
                      <div className="flex items-center gap-3 shrink-0 text-slate-600 font-medium">
                        <span>Ordered: <strong className="text-slate-900">{item.quantity}</strong></span>
                        <span>Received: <strong className="text-emerald-700">{item.receivedQuantity || 0}</strong></span>
                        {item.quantity > (item.receivedQuantity || 0) && (
                          <span className="text-rose-600 font-bold">Remaining: {item.quantity - (item.receivedQuantity || 0)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Date & Note Info */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-1">
                  <span>Order Date: {new Date(order.poDate).toISOString().split('T')[0]}</span>
                  {order.expectedDate && <span>Expected: {new Date(order.expectedDate).toISOString().split('T')[0]}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE STOCK ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">+ New Stock Order</h3>
                <p className="text-xs text-slate-500 font-medium">Order spare parts from wholesale supplier</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStockOrder} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. ABC Mobile Parts"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Ordered Products & Quantities</label>
                {orderItems.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={row.productName}
                      onChange={(e) => handleUpdateItemRow(idx, 'productName', e.target.value)}
                      placeholder="e.g. Samsung A15 Battery"
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      required
                      min="1"
                      value={row.quantity}
                      onChange={(e) => handleUpdateItemRow(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="any"
                      value={row.unitPrice}
                      onChange={(e) => handleUpdateItemRow(idx, 'unitPrice', e.target.value)}
                      placeholder="Rate ₹"
                      className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 text-center focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    {orderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Another Product</span>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingOrder}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {creatingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                  <span>Confirm Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE STOCK INTAKE MODAL */}
      {receivingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Receive Stock from {receivingOrder.supplierName}</h3>
                <p className="text-xs text-slate-500 font-medium">Enter actual delivered pieces to update Godown inventory</p>
              </div>
              <button onClick={() => setReceivingOrder(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceiveStock} className="space-y-3.5">
              <div className="space-y-2.5">
                {receivingOrder.items.map((item) => {
                  const remaining = Math.max(0, item.quantity - (item.receivedQuantity || 0));
                  return (
                    <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <strong className="text-slate-900 font-bold">{item.productName}</strong>
                        <span className="text-slate-500">Ordered: {item.quantity} | Prev Received: {item.receivedQuantity || 0}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-600 font-semibold">Quantity Arrived Now:</span>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receiveInputs[item.id] || ''}
                          onChange={(e) => setReceiveInputs({ ...receiveInputs, [item.id]: e.target.value })}
                          className="w-28 p-2 bg-white border border-slate-300 rounded-xl text-center font-black text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setReceivingOrder(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={receivingLoading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {receivingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                  <span>Confirm Intake to Godown</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
