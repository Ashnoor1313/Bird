import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { CustomSelect } from '../components/common/CustomSelect';
import {
  Users,
  Plus,
  Search,
  Phone,
  ArrowDownLeft,
  Share2,
  FileText,
  X,
  RefreshCw,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { WhatsAppReminderModal } from '../components/modals/WhatsAppReminderModal';

import { useCustomersData } from '../hooks/useApiQueries';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';
import { TableSkeletonLoader } from '../components/common/SkeletonLoader';

export const CustomersPage = () => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, locations } = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState('folders');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'new');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // TanStack Query (Instant Cached with SWR)
  const {
    data: customers = [],
    isLoading: loading,
    isFetching,
    refetch: fetchCustomers,
  } = useCustomersData(
    activeBusinessId,
    activeLocationId,
    activeCategory,
    debouncedSearch
  );

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState(null);

  // Edit & Delete state
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    state: 'Delhi',
    priceLevel: 'RETAIL',
    openingBalance: '0',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    state: 'Delhi',
    priceLevel: 'RETAIL',
  });

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const targetLocId = (activeLocationId && activeLocationId !== 'ALL')
        ? activeLocationId
        : (locations?.find(l => l.type === 'STORE')?.id || locations?.[0]?.id);

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          businessId: activeBusinessId,
          locationId: targetLocId,
          categoryId: activeCategory,
        }),
      });

      if (res.ok) {
        addToast('Customer profile added!', 'success');
        setShowAddModal(false);
        setFormData({ name: '', phone: '', email: '', address: '', gstin: '', state: 'Delhi', priceLevel: 'RETAIL', openingBalance: '0' });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        const errorData = await res.json();
        addToast(errorData.error || 'Failed to save customer', 'error');
      }
    } catch (err) {
      addToast('Failed to save customer', 'error');
    }
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setEditFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      gstin: customer.gstin || '',
      state: customer.state || 'Delhi',
      priceLevel: customer.priceLevel || 'RETAIL',
    });
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer || !editFormData.name.trim()) return;

    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (res.ok) {
        const updated = await res.json();
        addToast('Customer details updated!', 'success');
        setShowEditModal(false);
        setEditingCustomer(null);

        if (selectedCustomer?.id === updated.id) {
          setSelectedCustomer({ ...selectedCustomer, ...updated });
        }
        fetchCustomers();
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        addToast('Failed to update customer', 'error');
      }
    } catch (err) {
      addToast('Failed to update customer', 'error');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    try {
      const res = await fetch(`/api/customers/${deletingCustomer.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addToast('Customer profile deleted', 'success');
        if (selectedCustomer?.id === deletingCustomer.id) {
          setSelectedCustomer(null);
        }
        setDeletingCustomer(null);
        fetchCustomers();
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        addToast('Failed to delete customer', 'error');
      }
    } catch (err) {
      addToast('Failed to delete customer', 'error');
    }
  };

  const loadCustomerKhata = async (cust) => {
    try {
      const res = await fetch(`/api/customers/${cust.id}`);
      if (res.ok) {
        setSelectedCustomer(await res.json());
      }
    } catch (err) {}
  };

  const handleShareWhatsApp = (cust) => {
    setWhatsAppCustomer(cust);
    setShowWhatsAppModal(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-700" />
            <span>Customers & Khata Ledgers</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">Track customer balances ("Money to Receive"), bills & payments.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Customer</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setActiveCategory('folders');
            setSelectedCustomer(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeCategory === 'folders'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <span>Folders Customers</span>
        </button>
        <button
          onClick={() => {
            setActiveCategory('batteries');
            setSelectedCustomer(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeCategory === 'batteries'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <span>Batteries Customers</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer name or phone..."
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

      {/* Customer List & Khata Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-zinc-500 text-xs font-semibold">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-600" />
              Loading customer profiles...
            </div>
          ) : customers.length === 0 ? (
            <div className="bird-card p-6 text-center text-zinc-500 text-xs font-medium">
              No customers registered. Tap "+ Add Customer" to create one.
            </div>
          ) : (
            customers.map((c) => (
              <div
                key={c.id}
                onClick={() => loadCustomerKhata(c)}
                className={`bird-card bird-card-hover p-3.5 cursor-pointer transition-colors ${
                  selectedCustomer?.id === c.id ? 'border-zinc-900 bg-zinc-50 shadow-xs' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-xs tracking-tight">{c.name}</h3>
                    <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-zinc-400" /> {c.phone || 'No phone'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-medium text-zinc-400">Due (Khata)</div>
                    <div className="text-xs font-bold text-amber-700 tabular-nums">₹{c.moneyToReceive.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Pane: Selected Customer Khata Ledger */}
        <div className="lg:col-span-2 bird-card p-5 space-y-4">
          {!selectedCustomer ? (
            <div className="text-center py-20 text-zinc-400 text-xs font-medium">
              Select a customer from the list to view their detailed Khata ledger timeline.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">{selectedCustomer.name}</h2>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">Phone: {selectedCustomer.phone || 'N/A'} • {selectedCustomer.address || 'Delhi'}</div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleShareWhatsApp(selectedCustomer)}
                    className="btn-secondary py-1.5 px-2.5"
                  >
                    <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => openEditModal(selectedCustomer)}
                    className="btn-secondary py-1.5 px-2.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setDeletingCustomer(selectedCustomer)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Overall Customer Outstanding</div>
                  <div className="text-xl font-bold text-zinc-900 mt-0.5 tabular-nums">
                    ₹{selectedCustomer.moneyToReceive.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Location-wise Outstanding Breakdown */}
                {selectedCustomer.storeBreakdown && selectedCustomer.storeBreakdown.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/60 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold text-zinc-500 self-center">Store Breakdown:</span>
                    {selectedCustomer.storeBreakdown.map((sb) => (
                      <span
                        key={sb.locationId}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                          sb.outstanding > 0
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-white text-zinc-600 border-zinc-200'
                        }`}
                      >
                        <span>{sb.locationName}:</span> <strong className="tabular-nums">₹{sb.outstanding.toLocaleString('en-IN')}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Ledger Entries Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Khata History</h3>
                {selectedCustomer.ledgers?.length === 0 ? (
                  <div className="text-slate-400 text-xs py-6 text-center font-medium">No ledger entries recorded yet.</div>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.ledgers?.map((leg) => (
                      <div key={leg.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{leg.note || leg.reference}</div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">{new Date(leg.createdAt).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-extrabold text-sm ${leg.type === 'BILL' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {leg.type === 'BILL' ? `+₹${leg.amount}` : `-₹${leg.amount}`}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Balance: ₹{leg.balanceAfter}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Add Customer Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Mobile Repair Hub"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price Level / Customer Tier</label>
                <CustomSelect
                  value={formData.priceLevel}
                  onChange={(val) => setFormData({ ...formData, priceLevel: val })}
                  options={[
                    { value: 'RETAIL', label: '🛍️ Retail Customer' },
                    { value: 'REPAIR_SHOP', label: '🔧 Repair Shop / Technician' },
                    { value: 'DEALER', label: '🏪 Dealer / Reseller' },
                    { value: 'WHOLESALE', label: '🏭 Wholesaler' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Due Balance (₹)</label>
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
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Edit Customer Details</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price Level / Customer Tier</label>
                <CustomSelect
                  value={editFormData.priceLevel}
                  onChange={(val) => setEditFormData({ ...editFormData, priceLevel: val })}
                  options={[
                    { value: 'RETAIL', label: '🛍️ Retail Customer' },
                    { value: 'REPAIR_SHOP', label: '🔧 Repair Shop / Technician' },
                    { value: 'DEALER', label: '🏪 Dealer / Reseller' },
                    { value: 'WHOLESALE', label: '🏭 Wholesaler' },
                  ]}
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
                  Update Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Delete Customer?</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Are you sure you want to delete <strong className="text-slate-800">{deletingCustomer.name}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold text-xs text-white transition-all shadow-md shadow-rose-500/20 w-full"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP REMINDER MODAL */}
      <WhatsAppReminderModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        customer={whatsAppCustomer}
        business={{ name: 'Bird Mobile Parts' }}
      />
    </div>
  );
};

export default CustomersPage;

