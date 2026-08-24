import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  Building2,
  Plus,
  Search,
  Phone,
  ArrowUpRight,
  X,
  RefreshCw,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { useSuppliersData } from '../hooks/useApiQueries';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';
import { TableSkeletonLoader } from '../components/common/SkeletonLoader';

export const SuppliersPage = () => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, locations } = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'new');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // TanStack Query for Suppliers list (Instant Cached with SWR)
  const {
    data: suppliers = [],
    isLoading: loading,
    isFetching,
    refetch: fetchSuppliers,
  } = useSuppliersData(
    activeBusinessId,
    activeLocationId,
    debouncedSearch
  );

  // Edit / Delete State
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    state: 'Delhi',
    openingBalance: '0',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    state: 'Delhi',
  });

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const targetLocId = (activeLocationId && activeLocationId !== 'ALL')
        ? activeLocationId
        : (locations?.find(l => l.type === 'STORE')?.id || locations?.[0]?.id);

      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          businessId: activeBusinessId,
          locationId: targetLocId,
        }),
      });

      if (res.ok) {
        addToast('Supplier added successfully!', 'success');
        setShowAddModal(false);
        setFormData({ name: '', phone: '', email: '', address: '', gstin: '', state: 'Delhi', openingBalance: '0' });
        fetchSuppliers();
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        const errorData = await res.json();
        addToast(errorData.error || 'Failed to save supplier', 'error');
      }
    } catch (err) {
      addToast('Failed to save supplier', 'error');
    }
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setEditFormData({
      name: supplier.name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      gstin: supplier.gstin || '',
      state: supplier.state || 'Delhi',
    });
    setShowEditModal(true);
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!editingSupplier || !editFormData.name.trim()) return;

    try {
      const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (res.ok) {
        const updated = await res.json();
        addToast('Supplier details updated!', 'success');
        setShowEditModal(false);
        setEditingSupplier(null);

        if (selectedSupplier?.id === updated.id) {
          setSelectedSupplier({ ...selectedSupplier, ...updated });
        }
        fetchSuppliers();
      } else {
        addToast('Failed to update supplier', 'error');
      }
    } catch (err) {
      addToast('Failed to update supplier', 'error');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;

    try {
      const res = await fetch(`/api/suppliers/${deletingSupplier.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addToast('Supplier profile deleted', 'success');
        if (selectedSupplier?.id === deletingSupplier.id) {
          setSelectedSupplier(null);
        }
        setDeletingSupplier(null);
        fetchSuppliers();
      } else {
        addToast('Failed to delete supplier', 'error');
      }
    } catch (err) {
      addToast('Failed to delete supplier', 'error');
    }
  };

  const loadSupplierKhata = async (supp) => {
    try {
      const res = await fetch(`/api/suppliers/${supp.id}`);
      if (res.ok) setSelectedSupplier(await res.json());
    } catch (err) {}
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-zinc-700" />
            <span>Wholesale Suppliers & Payables</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">Track supplier Khatas ("Money to Pay") & purchase orders.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Supplier</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wholesale supplier name, phone..."
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-zinc-500 text-xs font-semibold">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-600" />
              Loading suppliers...
            </div>
          ) : suppliers.length === 0 ? (
            <div className="bird-card p-6 text-center text-zinc-500 text-xs font-medium">
              No suppliers registered. Tap "+ Add Supplier" to create one.
            </div>
          ) : (
            suppliers.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSupplierKhata(s)}
                className={`bird-card bird-card-hover p-3.5 cursor-pointer transition-colors ${
                  selectedSupplier?.id === s.id ? 'border-zinc-900 bg-zinc-50 shadow-xs' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-xs tracking-tight">{s.name}</h3>
                    <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-zinc-400" /> {s.phone || 'No phone'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-medium text-zinc-400">Due to Pay</div>
                    <div className="text-xs font-bold text-zinc-900 tabular-nums">₹{s.moneyToPay.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2 bird-card p-5 space-y-4">
          {!selectedSupplier ? (
            <div className="text-center py-20 text-zinc-400 text-xs font-medium">
              Select a supplier from the list to view detailed purchase history & Khata ledger.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">{selectedSupplier.name}</h2>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">Phone: {selectedSupplier.phone || 'N/A'} • GSTIN: {selectedSupplier.gstin || 'N/A'}</div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(selectedSupplier)}
                    className="btn-secondary py-1.5 px-2.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setDeletingSupplier(selectedSupplier)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Overall Supplier Payable</div>
                  <div className="text-xl font-bold text-zinc-900 mt-0.5 tabular-nums">
                    You need to pay: ₹{selectedSupplier.moneyToPay.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Location-wise Payable Breakdown */}
                {selectedSupplier.storeBreakdown && selectedSupplier.storeBreakdown.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/60 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold text-zinc-500 self-center">Store Breakdown:</span>
                    {selectedSupplier.storeBreakdown.map((sb) => (
                      <span
                        key={sb.locationId}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                          sb.payable > 0
                            ? 'bg-zinc-200 text-zinc-900 border-zinc-300'
                            : 'bg-white text-zinc-600 border-zinc-200'
                        }`}
                      >
                        <span>{sb.locationName}:</span> <strong className="tabular-nums">₹{sb.payable.toLocaleString('en-IN')}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Supplier Ledger History</h3>
                {selectedSupplier.ledgers?.map((leg) => (
                  <div key={leg.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{leg.note || leg.reference}</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">{new Date(leg.createdAt).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-extrabold text-sm ${leg.type === 'PURCHASE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {leg.type === 'PURCHASE' ? `+₹${leg.amount}` : `-₹${leg.amount}`}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Balance: ₹{leg.balanceAfter}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Add Supplier Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Mobile Parts Wholesale"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone</label>
                <input
                  type="text"
                  placeholder="+91 99100 88776"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Payable Balance (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-extrabold"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold text-xs text-white transition-all shadow-md shadow-blue-500/20">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Edit Supplier Details</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Business Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={editFormData.gstin}
                  onChange={(e) => setEditFormData({ ...editFormData, gstin: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold text-xs text-white transition-all shadow-md shadow-blue-500/20">
                  Update Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Delete Supplier?</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Are you sure you want to delete <strong className="text-slate-800">{deletingSupplier.name}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSupplier(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold text-xs text-white transition-all shadow-md shadow-rose-500/20 w-full"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;

