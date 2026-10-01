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
  ChevronDown,
  ChevronUp,
  Printer,
  Receipt,
  Calendar,
  DollarSign,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  ArrowUpRight,
  ShoppingBag,
  CreditCard,
  History,
  Info,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { WhatsAppReminderModal } from '../components/modals/WhatsAppReminderModal';
import { InvoiceModal } from '../components/modals/InvoiceModal';

import { useCustomersData } from '../hooks/useApiQueries';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';

export const CustomersPage = () => {
  const { activeBusinessId, business } = useBusiness();
  const { activeLocationId, locations } = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'new');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingKhata, setLoadingKhata] = useState(false);

  // Active Detail Tab: 'orders' | 'payments' | 'ledger'
  const [detailTab, setDetailTab] = useState('orders');

  // Expanded Accordion Order ID
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Invoice Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);

  // Order Search Filter inside customer view
  const [orderSearch, setOrderSearch] = useState('');

  // TanStack Query (Instant Cached with SWR)
  const {
    data: customers = [],
    isLoading: loading,
    isFetching,
    refetch: fetchCustomers,
  } = useCustomersData(
    activeBusinessId,
    activeLocationId,
    activeCategory === 'all' ? 'ALL' : activeCategory,
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
      const targetLocId =
        activeLocationId && activeLocationId !== 'ALL'
          ? activeLocationId
          : locations?.find((l) => l.type === 'STORE')?.id || locations?.[0]?.id;

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          businessId: activeBusinessId,
          locationId: targetLocId,
          categoryId: activeCategory === 'all' ? 'folders' : activeCategory,
        }),
      });

      if (res.ok) {
        addToast('Customer profile added!', 'success');
        setShowAddModal(false);
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          gstin: '',
          state: 'Delhi',
          priceLevel: 'RETAIL',
          openingBalance: '0',
        });
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
          setSelectedCustomer((prev) => ({ ...prev, ...updated }));
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
    setLoadingKhata(true);
    try {
      const res = await fetch(`/api/customers/${cust.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCustomer(data);
        // Expand first order if available
        if (data.sales && data.sales.length > 0) {
          setExpandedOrderId(data.sales[0].id);
        }
      }
    } catch (err) {
      addToast('Failed to load customer details', 'error');
    } finally {
      setLoadingKhata(false);
    }
  };

  const handleShareWhatsApp = (cust) => {
    setWhatsAppCustomer(cust);
    setShowWhatsAppModal(true);
  };

  const openInvoice = (sale) => {
    setSelectedSaleForInvoice(sale);
    setShowInvoiceModal(true);
  };

  // Compute total money to receive across loaded customers
  const totalKhataOutstanding = customers.reduce((acc, c) => acc + (c.moneyToReceive || 0), 0);

  // Filter sales for selected customer
  const filteredSales = (selectedCustomer?.sales || []).filter((sale) => {
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase();
    const billMatch = sale.billNo?.toLowerCase().includes(q);
    const itemMatch = sale.items?.some((i) =>
      i.productName?.toLowerCase().includes(q) || i.model?.toLowerCase().includes(q)
    );
    return billMatch || itemMatch;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-700" />
            <span>Customer History & Khata Ledgers</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">
            Complete order history, itemized bills, payment receipts & pending balance per customer.
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Customer</span>
        </button>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Customers</div>
            <div className="text-lg font-bold text-zinc-900 mt-0.5">{customers.length} Profiles</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Khata Pending</div>
            <div className="text-lg font-bold text-amber-600 mt-0.5 tabular-nums">
              ₹{totalKhataOutstanding.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Category View</div>
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => {
                  setActiveCategory('all');
                  setSelectedCustomer(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeCategory === 'all'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setActiveCategory('folders');
                  setSelectedCustomer(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeCategory === 'folders'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Folders
              </button>
              <button
                onClick={() => {
                  setActiveCategory('batteries');
                  setSelectedCustomer(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeCategory === 'batteries'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Batteries
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Customer Selection List (Left) & Customer Detailed History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Customer Directory */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full pl-9 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs"
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

          {/* Customer Cards List */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-12 text-zinc-500 text-xs font-semibold">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-600" />
                Loading customer profiles...
              </div>
            ) : customers.length === 0 ? (
              <div className="bird-card p-6 text-center text-zinc-500 text-xs font-medium">
                No customers found matching criteria. Tap "+ Add Customer" to create one.
              </div>
            ) : (
              customers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                const initials = c.name
                  ? c.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'CU';

                return (
                  <div
                    key={c.id}
                    onClick={() => loadCustomerKhata(c)}
                    className={`bird-card p-3 cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                        : 'border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            isSelected ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                            {c.name}
                          </h3>
                          <div className={`text-[11px] font-medium flex items-center gap-1 mt-0.5 ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <Phone className="w-3 h-3 opacity-70" /> {c.phone || 'No phone'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-[10px] font-semibold uppercase tracking-wider ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>
                          Khata Due
                        </div>
                        <div
                          className={`text-xs font-extrabold tabular-nums mt-0.5 ${
                            c.moneyToReceive > 0
                              ? isSelected
                                ? 'text-amber-300'
                                : 'text-amber-700'
                              : isSelected
                              ? 'text-emerald-400'
                              : 'text-emerald-600'
                          }`}
                        >
                          ₹{(c.moneyToReceive || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer History & Detailed Orders Pane */}
        <div className="lg:col-span-8 bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          {!selectedCustomer ? (
            <div className="text-center py-24 text-zinc-400 text-xs font-medium space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-700 text-sm">No Customer Selected</p>
                <p className="text-zinc-400 text-xs mt-1">Select a customer from the left directory to inspect their complete order history & bills.</p>
              </div>
            </div>
          ) : loadingKhata ? (
            <div className="text-center py-24 text-zinc-500 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-600" />
              Fetching complete customer order history...
            </div>
          ) : (
            <>
              {/* Customer Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                    {selectedCustomer.name
                      ? selectedCustomer.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'CU'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-zinc-900">{selectedCustomer.name}</h2>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-bold uppercase tracking-wider">
                        {selectedCustomer.priceLevel || 'RETAIL'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 font-medium mt-0.5 flex flex-wrap items-center gap-3">
                      <span><Phone className="w-3 h-3 inline mr-1 text-zinc-400" />{selectedCustomer.phone || 'No Phone'}</span>
                      {selectedCustomer.address && <span>• {selectedCustomer.address}</span>}
                      {selectedCustomer.gstin && <span>• GST: {selectedCustomer.gstin}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleShareWhatsApp(selectedCustomer)}
                    className="btn-secondary py-1.5 px-3 text-xs"
                    title="Send WhatsApp Khata Statement"
                  >
                    <Share2 className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => openEditModal(selectedCustomer)}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={() => setDeletingCustomer(selectedCustomer)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg transition-colors"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4 Financial Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-50/90 p-3 rounded-xl border border-zinc-200/80">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Billed / Ordered</div>
                  <div className="text-base font-extrabold text-zinc-900 mt-0.5 tabular-nums">
                    ₹{(selectedCustomer.totalOrderedAmount || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-semibold text-zinc-500 mt-0.5">
                    {selectedCustomer.totalOrdersCount || selectedCustomer.sales?.length || 0} Orders Total
                  </div>
                </div>

                <div className="bg-zinc-50/90 p-3 rounded-xl border border-zinc-200/80">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Amount Received</div>
                  <div className="text-base font-extrabold text-emerald-600 mt-0.5 tabular-nums">
                    ₹{(selectedCustomer.totalReceivedAmount || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700/80 mt-0.5">
                    Payments Collected
                  </div>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Due Balance</div>
                  <div className="text-base font-extrabold text-amber-800 mt-0.5 tabular-nums">
                    ₹{(selectedCustomer.moneyToReceive || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                    Current Khata Due
                  </div>
                </div>

                <div className="bg-zinc-50/90 p-3 rounded-xl border border-zinc-200/80">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Store Branch</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1 truncate">
                    {selectedCustomer.location?.name || 'Store 1'}
                  </div>
                  {selectedCustomer.storeBreakdown && selectedCustomer.storeBreakdown.length > 0 && (
                    <div className="text-[10px] font-medium text-zinc-500 truncate mt-0.5">
                      {selectedCustomer.storeBreakdown.length} Active Stores
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-2">
                <button
                  onClick={() => setDetailTab('orders')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                    detailTab === 'orders'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Order History ({selectedCustomer.sales?.length || 0})</span>
                </button>

                <button
                  onClick={() => setDetailTab('payments')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                    detailTab === 'payments'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Payments Received ({selectedCustomer.payments?.length || 0})</span>
                </button>

                <button
                  onClick={() => setDetailTab('ledger')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                    detailTab === 'ledger'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Khata Timeline ({selectedCustomer.ledgers?.length || 0})</span>
                </button>
              </div>

              {/* TAB CONTENT 1: ORDER HISTORY WITH EXPANDABLE DETAILED BILL SUMMARY */}
              {detailTab === 'orders' && (
                <div className="space-y-3">
                  {/* Order Search Filter */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search bill number or item model..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-800"
                      />
                      {orderSearch && (
                        <button onClick={() => setOrderSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-semibold">
                      Showing {filteredSales.length} of {selectedCustomer.sales?.length || 0} Bills
                    </span>
                  </div>

                  {filteredSales.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 text-xs font-medium bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      No order bills recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSales.map((sale) => {
                        const isExpanded = expandedOrderId === sale.id;
                        const dateFormatted = new Date(sale.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        const isPaid = sale.dueAmount <= 0;
                        const isPartial = sale.paidAmount > 0 && sale.dueAmount > 0;

                        return (
                          <div
                            key={sale.id}
                            className={`rounded-xl border transition-all ${
                              isExpanded ? 'border-zinc-900 bg-white shadow-xs' : 'border-zinc-200/80 bg-zinc-50/60 hover:bg-white'
                            }`}
                          >
                            {/* Bill Header Row */}
                            <div
                              onClick={() => setExpandedOrderId(isExpanded ? null : sale.id)}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
                                  <Receipt className="w-4 h-4" />
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                                      #{sale.billNo}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isPaid
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : isPartial
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID / DUE'}
                                    </span>
                                    <span className="text-[10px] font-semibold text-zinc-500 uppercase bg-zinc-200/70 px-1.5 py-0.5 rounded">
                                      {sale.paymentMethod || 'CASH'}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5 mt-0.5">
                                    <Calendar className="w-3 h-3 text-zinc-400" />
                                    <span>{dateFormatted}</span>
                                    <span>•</span>
                                    <span>{sale.items?.length || 0} Items</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4">
                                <div className="text-right">
                                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    Bill Total
                                  </div>
                                  <div className="text-sm font-extrabold text-zinc-900 tabular-nums">
                                    ₹{sale.total?.toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[10px] font-medium text-zinc-500 mt-0.5">
                                    Paid: <span className="text-emerald-700 font-bold">₹{sale.paidAmount}</span>
                                    {sale.dueAmount > 0 && (
                                      <span className="ml-1.5 text-rose-600 font-bold">Due: ₹{sale.dueAmount}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-1 rounded-lg bg-zinc-100 text-zinc-600">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </div>

                            {/* EXPANDED DETAILED ORDER SUMMARY ACCORDION */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 border-t border-zinc-100 space-y-3 bg-white rounded-b-xl">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-zinc-600" />
                                    <span>Itemized Bill Description</span>
                                  </h4>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openInvoice(sale);
                                    }}
                                    className="btn-secondary py-1 px-2.5 text-xs text-zinc-800"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-zinc-600" />
                                    <span>View / Print Invoice</span>
                                  </button>
                                </div>

                                {/* Items Table */}
                                <div className="overflow-x-auto rounded-lg border border-zinc-200/80">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-zinc-50 border-b border-zinc-200/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="py-2 px-3">Product / Spare Part Model</th>
                                        <th className="py-2 px-3 text-center">Qty</th>
                                        <th className="py-2 px-3 text-right">Selling Rate</th>
                                        <th className="py-2 px-3 text-right">Discount</th>
                                        <th className="py-2 px-3 text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                                      {sale.items?.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-50/60">
                                          <td className="py-2.5 px-3 font-semibold text-zinc-900">
                                            {item.productName}
                                            {item.model && <span className="text-zinc-400 font-normal ml-1 font-mono">({item.model})</span>}
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-bold text-zinc-900">{item.quantity}</td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">₹{item.unitPrice}</td>
                                          <td className="py-2.5 px-3 text-right tabular-nums text-zinc-500">
                                            {item.discount > 0 ? `-₹${item.discount}` : '₹0'}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-bold text-zinc-900 tabular-nums">
                                            ₹{item.total?.toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Summary Financial Footer for Bill */}
                                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/60 flex flex-wrap items-center justify-between text-xs gap-2">
                                  <div className="text-zinc-500 font-medium">
                                    Payment Method: <strong className="text-zinc-800 uppercase">{sale.paymentMethod || 'CASH'}</strong>
                                    {sale.notes && <span className="ml-2 font-normal italic">• "{sale.notes}"</span>}
                                  </div>

                                  <div className="flex items-center gap-4 text-xs font-bold tabular-nums">
                                    <div>
                                      Subtotal: <span className="text-zinc-900">₹{sale.subtotal}</span>
                                    </div>
                                    {sale.discount > 0 && (
                                      <div className="text-rose-600">
                                        Discount: -₹{sale.discount}
                                      </div>
                                    )}
                                    <div className="text-sm text-zinc-900 border-l border-zinc-300 pl-3">
                                      Grand Total: ₹{sale.total?.toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 2: PAYMENTS RECEIVED */}
              {detailTab === 'payments' && (
                <div className="space-y-3">
                  {selectedCustomer.payments?.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 text-xs font-medium bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      No direct payment entries recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCustomer.payments?.map((pmt) => (
                        <div
                          key={pmt.id}
                          className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-zinc-900">
                                Payment Received ({pmt.paymentMethod || 'CASH'})
                              </div>
                              <div className="text-[11px] text-zinc-500 font-medium mt-0.5">
                                {new Date(pmt.createdAt).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {pmt.reference && <span className="ml-2">• Ref: #{pmt.reference}</span>}
                              </div>
                              {pmt.notes && (
                                <div className="text-[10px] text-zinc-500 italic mt-0.5">{pmt.notes}</div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-extrabold text-sm text-emerald-700 tabular-nums">
                              +₹{pmt.amount?.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] font-semibold text-emerald-800/80 uppercase">
                              Received
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 3: KHATA LEDGER TIMELINE */}
              {detailTab === 'ledger' && (
                <div className="space-y-3">
                  {selectedCustomer.ledgers?.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 text-xs font-medium bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      No ledger entries recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCustomer.ledgers?.map((leg) => (
                        <div
                          key={leg.id}
                          className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-zinc-900">{leg.note || leg.reference}</div>
                            <div className="text-[11px] text-zinc-500 font-medium mt-0.5">
                              {new Date(leg.createdAt).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-extrabold text-sm tabular-nums ${
                                leg.type === 'BILL' ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {leg.type === 'BILL' ? `+₹${leg.amount}` : `-₹${leg.amount}`}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                              Balance After: ₹{leg.balanceAfter?.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold text-xs text-white transition-all shadow-md shadow-blue-500/20"
                >
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
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold text-xs text-white transition-all shadow-md shadow-blue-500/20"
                >
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
                Are you sure you want to delete <strong className="text-slate-800">{deletingCustomer.name}</strong>?
                This action cannot be undone.
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
        business={business || { name: 'Bird Mobile Parts' }}
      />

      {/* OFFICIAL INVOICE MODAL */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        sale={selectedSaleForInvoice}
        business={business}
      />
    </div>
  );
};

export default CustomersPage;
