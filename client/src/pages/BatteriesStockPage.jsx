import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  Search,
  Plus,
  Download,
  X,
  BatteryCharging,
  RefreshCw,
  Boxes,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
  Receipt,
  ArrowRightLeft,
  Users,
  Wallet,
  Printer,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ReceiveMoneyModal } from '../components/modals/ReceiveMoneyModal';
import { InvoiceModal } from '../components/modals/InvoiceModal';
import { CategoryScanStockModal } from '../components/modals/CategoryScanStockModal';
import { Camera } from 'lucide-react';

import { useCategoryHubData, useCustomersData, useMoneyBalancesData } from '../hooks/useApiQueries';
import { useDebounce } from '../hooks/useDebounce';
import { PageSkeletonLoader } from '../components/common/SkeletonLoader';
import { useQueryClient } from '@tanstack/react-query';

export const BatteriesStockPage = () => {
  const { activeBusiness, activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation, locations, selectLocation } = useLocation();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // In Godown mode vs Store mode
  const isGodown = !activeLocation || activeLocation.type === 'GODOWN' || activeLocationId === 'ALL';
  const locationLabel = activeLocation?.name || 'Godown';

  // Active Sub-Tab when in Store mode: 'stock' | 'sales' | 'customers' | 'payments'
  const [activeTab, setActiveTab] = useState('stock');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'
  const [exporting, setExporting] = useState(false);

  // TanStack Query: Batteries Hub Data (Instant Cached with SWR)
  const { data, isLoading: loading, isFetching, refetch: loadBatteriesData } = useCategoryHubData(
    activeBusinessId,
    'Batteries',
    activeLocationId
  );

  // On-demand Store-Scoped Customers Query (Only loads when on customers tab)
  const { data: categoryCustomers = [] } = useCustomersData(
    activeBusinessId,
    activeLocationId,
    'batteries',
    '',
    1,
    100
  );

  // On-demand Store-Scoped Payments Query (Only loads when on payments tab)
  const { data: moneyData } = useMoneyBalancesData(
    activeBusinessId,
    activeLocationId,
    'batteries'
  );
  const categoryPayments = moneyData?.payments || [];

  // Modals
  const [showReceiveMoneyModal, setShowReceiveMoneyModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  // Quick Adjustment Modal (+ / -)
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD' | 'REMOVE'
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Add Model Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualQty, setManualQty] = useState('10');
  const [manualMinStock, setManualMinStock] = useState('5');
  const [manualPurchasePrice, setManualPurchasePrice] = useState('');
  const [manualSellingPrice, setManualSellingPrice] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  // Edit Modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editMinStock, setEditMinStock] = useState('5');
  const [updatingProduct, setUpdatingProduct] = useState(false);

  // Add Customer Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustOpeningBal, setNewCustOpeningBal] = useState('0');
  const [addingCust, setAddingCust] = useState(false);

  // Invoice modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const loadCategoryCustomers = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const loadCategoryPayments = () => {
    queryClient.invalidateQueries({ queryKey: ['money-balances'] });
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const locParam = activeLocationId && activeLocationId !== 'ALL' ? `&locationId=${activeLocationId}` : '';
      const url = `/api/products/export/excel?businessId=${activeBusinessId}&scope=category&categoryName=Batteries${locParam}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `BIRD_Batteries_Stock_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      addToast('Batteries stock exported to Excel!', 'success');
    } catch (err) {
      addToast('Failed to export Excel file', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Quick Adjustment (+ / -)
  const handleQuickAdjust = async (e) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const qtyNumber = parseInt(adjustQty, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      addToast('Please enter a valid quantity', 'error');
      return;
    }

    setAdjustLoading(true);
    try {
      const signedQty = adjustType === 'ADD' ? qtyNumber : -qtyNumber;
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          productId: adjustingProduct.id,
          locationId: activeLocationId && activeLocationId !== 'ALL' ? activeLocationId : undefined,
          quantity: signedQty,
          stockState: 'GOOD',
          type: 'MANUAL_ADJUSTMENT',
          note: `Battery stock update (${adjustType === 'ADD' ? '+' : '-'}${qtyNumber})`,
        }),
      });

      if (res.ok) {
        addToast(`Stock updated for ${adjustingProduct.name}`, 'success');
        setAdjustingProduct(null);
        setAdjustQty('');
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        loadBatteriesData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to adjust stock', 'error');
      }
    } catch (err) {
      addToast('Failed to adjust stock', 'error');
    } finally {
      setAdjustLoading(false);
    }
  };

  // Add Battery Model Submit
  const handleAddBatterySubmit = async (e) => {
    e.preventDefault();
    if (!manualName.trim()) {
      addToast('Model Name is required', 'error');
      return;
    }

    setAddingManual(true);
    try {
      const targetLocId = activeLocationId && activeLocationId !== 'ALL'
        ? activeLocationId
        : (locations?.find(l => l.type === 'GODOWN')?.id || locations?.[0]?.id);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          name: manualName.trim(),
          model: manualModel.trim() || manualName.trim(),
          brand: manualBrand.trim() || 'Universal',
          partType: 'Battery',
          purchasePrice: parseFloat(manualPurchasePrice) || 0,
          sellingPrice: parseFloat(manualSellingPrice || manualPurchasePrice) || 0,
          currentStock: parseInt(manualQty, 10) || 0,
          minStock: parseInt(manualMinStock, 10) || 5,
          locationId: targetLocId,
        }),
      });

      if (res.ok) {
        addToast(`Battery model "${manualName}" added!`, 'success');
        setShowManualModal(false);
        setManualName('');
        setManualBrand('');
        setManualModel('');
        setManualQty('10');
        setManualMinStock('5');
        setManualPurchasePrice('');
        setManualSellingPrice('');
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        loadBatteriesData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to add battery model', 'error');
      }
    } catch (err) {
      addToast('Error adding battery model', 'error');
    } finally {
      setAddingManual(false);
    }
  };

  // Edit Model Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    setUpdatingProduct(true);
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          categoryId: editingProduct.categoryId || undefined,
          name: editName.trim(),
          brand: editBrand.trim(),
          model: editModel.trim(),
          purchasePrice: parseFloat(editPurchasePrice) || 0,
          sellingPrice: parseFloat(editSellingPrice) || 0,
          minStock: parseInt(editMinStock, 10) || 5,
        }),
      });

      if (res.ok) {
        addToast(`Updated details for ${editName}`, 'success');
        setEditingProduct(null);
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        loadBatteriesData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to update battery', 'error');
      }
    } catch (err) {
      addToast('Error updating battery', 'error');
    } finally {
      setUpdatingProduct(false);
    }
  };

  // Add Customer Submit (Scoped to Batteries in this Store)
  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      addToast('Customer Name is required', 'error');
      return;
    }

    setAddingCust(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          locationId: activeLocationId && activeLocationId !== 'ALL' ? activeLocationId : locations?.[0]?.id,
          categoryId: 'batteries',
          name: newCustName.trim(),
          phone: newCustPhone.trim() || null,
          openingBalance: parseFloat(newCustOpeningBal || 0),
        }),
      });

      if (res.ok) {
        addToast(`Customer "${newCustName}" added to Batteries accounts!`, 'success');
        setShowAddCustomerModal(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustOpeningBal('0');
        loadCategoryCustomers();
        loadBatteriesData();
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to add customer', 'error');
      }
    } catch (err) {
      addToast('Error adding customer', 'error');
    } finally {
      setAddingCust(false);
    }
  };

  // Filter Products (Debounced for 60fps performance)
  const filteredProducts = (data?.products || []).filter((p) => {
    const q = debouncedSearch.toLowerCase().trim();
    const nameMatch = !q ||
                      (p.name || '').toLowerCase().includes(q) ||
                      (p.model || '').toLowerCase().includes(q) ||
                      (p.brand || '').toLowerCase().includes(q);
    if (!nameMatch) return false;

    const qty = p.displayQty ?? p.currentStock ?? 0;
    if (stockFilter === 'IN_STOCK') return qty > 0;
    if (stockFilter === 'LOW') return qty > 0 && qty <= (p.minStock || 5);
    if (stockFilter === 'OUT') return qty <= 0;
    return true;
  });

  const totalStoreStock = (data?.products || []).reduce((acc, p) => acc + (p.displayQty ?? p.currentStock ?? 0), 0);
  const totalMoneyToReceive = categoryCustomers.reduce((acc, c) => acc + (c.moneyToReceive || 0), 0);
  const bills = data?.sales || [];

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* Branch / Location Switcher */}
      {/* Branch / Location Switcher */}
      {locations && locations.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {locations.map((loc) => {
              const isSelected = activeLocationId === loc.id || (activeLocationId === 'ALL' && loc.type === 'GODOWN');
              return (
                <button
                  key={loc.id}
                  onClick={() => selectLocation(loc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700'
                  }`}
                >
                  <span>{loc.type === 'GODOWN' ? '🏭' : '🏪'}</span>
                  <span>{loc.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                loadBatteriesData();
                if (!isGodown) {
                  loadCategoryCustomers();
                  loadCategoryPayments();
                }
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bird-card p-4 sm:p-5 bg-gradient-to-br from-white to-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
            <BatteryCharging className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">
                {isGodown ? 'BATTERIES STOCK' : `${locationLabel} — BATTERIES`}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {isGodown ? 'Godown Inventory' : 'Store Mini-Business'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              {isGodown
                ? 'Central warehouse stock, procurement, and store distribution'
                : 'Dedicated Battery sales, customer accounts, store stock & payments'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowScanModal(true)}
            className="btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs w-full sm:w-auto"
            title="Scan paper bill or invoice to auto-add stock"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Scan Bill (OCR)</span>
          </button>

          {!isGodown ? (
            <button
              onClick={() => navigate('/sales?action=new&category=batteries')}
              className="btn-secondary py-2 px-3 text-xs shadow-xs flex items-center justify-center gap-1.5 font-bold w-full sm:w-auto text-zinc-900 border-zinc-300 hover:bg-zinc-100"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">+ Create Bill</span>
            </button>
          ) : (
            <button
              onClick={() => setShowSendModal(true)}
              className="btn-secondary py-2 px-3 text-xs shadow-xs flex items-center justify-center gap-1.5 font-bold w-full sm:w-auto text-zinc-900 border-zinc-300 hover:bg-zinc-100"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Send Stock</span>
            </button>
          )}

          <button
            onClick={() => setShowManualModal(true)}
            className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5 font-semibold w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">+ Add Battery</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5 font-semibold w-full sm:w-auto"
          >
            {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
            <span className="truncate">Export</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STORE MODE: MINI-BUSINESS TOP METRICS & SUB-TABS */}
      {/* ========================================================================= */}
      {!isGodown ? (
        <div className="space-y-4">
          {/* Top Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bird-card p-3 bg-white border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Today's Sales</span>
              <p className="text-lg font-black text-zinc-900 tabular-nums mt-0.5">
                ₹{(data?.todayCategorySales || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bird-card p-3 bg-white border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Store Stock</span>
              <p className="text-lg font-black text-zinc-900 tabular-nums mt-0.5">
                {totalStoreStock.toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-zinc-400">pcs</span>
              </p>
            </div>
            <div className="bird-card p-3 bg-white border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Bills</span>
              <p className="text-lg font-black text-zinc-900 tabular-nums mt-0.5">
                {bills.length}
              </p>
            </div>
            <div className="bird-card p-3 bg-white border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Customers</span>
              <p className="text-lg font-black text-zinc-900 tabular-nums mt-0.5">
                {categoryCustomers.length}
              </p>
            </div>
            <div className="bird-card p-3 bg-white border border-zinc-200 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Money to Receive</span>
              <p className="text-lg font-black text-amber-700 tabular-nums mt-0.5">
                ₹{totalMoneyToReceive.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'stock', label: '📦 Stock Inventory', icon: Boxes },
              { id: 'sales', label: '📈 Sales & Bills', icon: Receipt },
              { id: 'customers', label: '👥 Customers & Khata', icon: Users },
              { id: 'payments', label: '💰 Payments Received', icon: Wallet },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* GODOWN MODE: METRICS STRIP */
        /* ========================================================================= */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setStockFilter('ALL')}
            className={`bird-card p-3.5 cursor-pointer transition-all ${
              stockFilter === 'ALL' ? 'border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50' : 'bird-card-hover'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
              <span>Total Battery Stock</span>
              <Boxes className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xl font-bold tracking-tight text-zinc-900">
              {(data?.totalStockPcs || 0).toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-zinc-400">pcs</span>
            </p>
            <span className="text-[10px] text-zinc-400 font-medium mt-0.5 block">
              ₹{(data?.totalStockValue || 0).toLocaleString('en-IN')} Valuation
            </span>
          </div>

          <div
            onClick={() => setStockFilter('IN_STOCK')}
            className={`bird-card p-3.5 cursor-pointer transition-all ${
              stockFilter === 'IN_STOCK' ? 'border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50' : 'bird-card-hover'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
              <span>In-Stock Models</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold tracking-tight text-zinc-900">
              {(data?.products || []).filter(p => (p.displayQty ?? p.currentStock ?? 0) > 0).length}{' '}
              <span className="text-xs font-normal text-zinc-400">models</span>
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
              Ready to distribute
            </span>
          </div>

          <div
            onClick={() => setStockFilter('LOW')}
            className={`bird-card p-3.5 cursor-pointer transition-all ${
              stockFilter === 'LOW' ? 'border-amber-600 ring-1 ring-amber-600 bg-amber-50/40' : 'bird-card-hover'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
              <span>Low Stock Alert</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold tracking-tight text-amber-700">
              {data?.lowStockCount || 0} <span className="text-xs font-normal text-zinc-400">models</span>
            </p>
            <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">
              Needs procurement
            </span>
          </div>

          <div
            onClick={() => setStockFilter('OUT')}
            className={`bird-card p-3.5 cursor-pointer transition-all ${
              stockFilter === 'OUT' ? 'border-rose-600 ring-1 ring-rose-600 bg-rose-50/40' : 'bird-card-hover'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
              <span>Out of Stock</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-bold tracking-tight text-rose-700">
              {data?.outOfStockCount || 0} <span className="text-xs font-normal text-zinc-400">models</span>
            </p>
            <span className="text-[10px] text-rose-600 font-medium mt-0.5 block">
              0 pcs in Godown
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: STOCK INVENTORY */}
      {/* ========================================================================= */}
      {(isGodown || activeTab === 'stock') && (
        <div className="space-y-3">
          {/* Search & Stock Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search battery model (e.g. BN56, BLP793, iPhone 11 battery)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setStockFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                  stockFilter === 'ALL' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                All ({data?.products?.length || 0})
              </button>
              <button
                onClick={() => setStockFilter('IN_STOCK')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                  stockFilter === 'IN_STOCK' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                In Stock
              </button>
              <button
                onClick={() => setStockFilter('LOW')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                  stockFilter === 'LOW' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Low ({data?.lowStockCount || 0})
              </button>
              <button
                onClick={() => setStockFilter('OUT')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                  stockFilter === 'OUT' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Out ({data?.outOfStockCount || 0})
              </button>
            </div>
          </div>

          {/* Stock Table */}
          {filteredProducts.length === 0 ? (
            <div className="bird-card p-12 text-center space-y-3">
              <BatteryCharging className="w-10 h-10 text-zinc-300 mx-auto" />
              <div className="text-sm font-bold text-zinc-800">No battery models match</div>
              <button onClick={() => setShowManualModal(true)} className="btn-primary text-xs py-2 px-3">
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Battery Model</span>
              </button>
            </div>
          ) : (
            <div className="bird-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Battery Model</th>
                      <th>Brand</th>
                      <th>Purchase Cost (₹)</th>
                      <th>Selling Rate (₹)</th>
                      <th>Available Stock</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const qty = p.displayQty ?? p.currentStock ?? 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="font-bold text-zinc-900 text-xs">{p.name}</div>
                            {p.model && p.model !== p.name && (
                              <div className="text-[10px] text-zinc-400 font-medium">Model: {p.model}</div>
                            )}
                          </td>
                          <td>
                            {p.brand ? (
                              <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                                {p.brand}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="text-xs text-zinc-600 font-bold tabular-nums">
                            ₹{(p.purchasePrice || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="text-xs font-extrabold text-zinc-900 tabular-nums">
                            ₹{(p.sellingPrice || 0).toLocaleString('en-IN')}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className={`font-extrabold text-sm tabular-nums ${
                                qty <= 0 ? 'text-rose-600' : qty <= (p.minStock || 5) ? 'text-amber-600' : 'text-zinc-900'
                              }`}>
                                {qty} <span className="text-xs font-normal text-zinc-400">pcs</span>
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setAdjustingProduct(p);
                                    setAdjustType('ADD');
                                  }}
                                  className="w-6 h-6 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs"
                                  title="Add stock pieces"
                                >
                                  +
                                </button>
                                <button
                                  onClick={() => {
                                    setAdjustingProduct(p);
                                    setAdjustType('REMOVE');
                                  }}
                                  className="w-6 h-6 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs"
                                  title="Reduce stock pieces"
                                >
                                  −
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setEditName(p.name);
                                  setEditBrand(p.brand || '');
                                  setEditModel(p.model || '');
                                  setEditPurchasePrice((p.purchasePrice || 0).toString());
                                  setEditSellingPrice((p.sellingPrice || 0).toString());
                                  setEditMinStock((p.minStock || 5).toString());
                                }}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                                title="Edit battery details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALES & INVOICES (STORE MODE) */}
      {/* ========================================================================= */}
      {!isGodown && activeTab === 'sales' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-zinc-900">Battery Sales Bills ({bills.length})</h3>
            <button
              onClick={() => navigate('/sales?action=new&category=batteries')}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Bill</span>
            </button>
          </div>

          {bills.length === 0 ? (
            <div className="bird-card p-12 text-center space-y-2">
              <Receipt className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-xs font-bold text-zinc-700">No battery bills yet in {locationLabel}</p>
            </div>
          ) : (
            <div className="bird-card overflow-hidden">
              {/* MOBILE VIEW (< sm): Responsive Sales Bill Cards */}
              <div className="block sm:hidden divide-y divide-zinc-200/80 bg-white">
                {bills.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedInvoice(b);
                      setShowInvoiceModal(true);
                    }}
                    className="p-3.5 space-y-2 hover:bg-zinc-50/60 active:bg-zinc-100/60 transition-colors cursor-pointer"
                  >
                    {/* Top Row: Bill No, Date & Total */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-blue-600">#{b.billNo}</span>
                        <span className="text-[11px] text-zinc-400">•</span>
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {new Date(b.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <span className="font-extrabold text-sm text-zinc-900 tabular-nums">
                        ₹{(b.total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Middle Row: Customer Name & Items */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-bold text-zinc-800 truncate">
                        👤 {b.customerName || 'Walk-in Customer'}
                      </div>
                      <span className="text-[11px] text-zinc-500 font-medium bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 shrink-0">
                        📦 {b.items?.length || 0} Parts
                      </span>
                    </div>

                    {/* Bottom Row: Status Badge & Print Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                      <div>
                        {b.dueAmount > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ⚠️ Due: ₹{b.dueAmount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✅ Paid Full
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedInvoice(b);
                            setShowInvoiceModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 flex items-center gap-1 shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP VIEW (>= sm): Full Table */}
              <table className="hidden sm:table enterprise-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total (₹)</th>
                    <th>Status</th>
                    <th className="text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => {
                        setSelectedInvoice(b);
                        setShowInvoiceModal(true);
                      }}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="font-mono font-bold text-xs text-blue-600 hover:underline">#{b.billNo}</td>
                      <td className="text-xs text-zinc-500">
                        {new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="font-semibold text-xs text-zinc-900">{b.customerName}</td>
                      <td className="text-xs text-zinc-500">{b.items?.length || 0} Parts</td>
                      <td className="font-extrabold text-xs text-zinc-900 tabular-nums">
                        ₹{(b.total || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {b.dueAmount > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Due: ₹{b.dueAmount}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedInvoice(b);
                              setShowInvoiceModal(true);
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 flex items-center gap-1 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CUSTOMERS & KHATA (STORE MODE) */}
      {/* ========================================================================= */}
      {!isGodown && activeTab === 'customers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-zinc-900">Battery Customers in {locationLabel} ({categoryCustomers.length})</h3>
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Customer</span>
            </button>
          </div>

          {categoryCustomers.length === 0 ? (
            <div className="bird-card p-12 text-center space-y-2">
              <Users className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-xs font-bold text-zinc-700">No battery customers registered in {locationLabel} yet</p>
              <button onClick={() => setShowAddCustomerModal(true)} className="btn-primary text-xs py-1.5 px-3">
                + Add Customer
              </button>
            </div>
          ) : (
            <div className="bird-card overflow-hidden">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Unpaid Due (₹)</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryCustomers.map((c) => (
                    <tr key={c.id}>
                      <td className="font-bold text-xs text-zinc-900">{c.name}</td>
                      <td className="text-xs text-zinc-500">{c.phone || '—'}</td>
                      <td>
                        {c.moneyToReceive > 0 ? (
                          <span className="text-xs font-extrabold text-amber-700 tabular-nums">
                            ₹{c.moneyToReceive.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700">Clear</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            setShowReceiveMoneyModal(true);
                          }}
                          className="btn-secondary py-1 px-2.5 text-[11px] font-bold"
                        >
                          💰 Receive Money
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENTS (STORE MODE) */}
      {/* ========================================================================= */}
      {!isGodown && activeTab === 'payments' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-zinc-900">Battery Payments in {locationLabel}</h3>
            <button
              onClick={() => setShowReceiveMoneyModal(true)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>💰 Receive Money</span>
            </button>
          </div>

          {categoryPayments.length === 0 ? (
            <div className="bird-card p-12 text-center space-y-2">
              <Wallet className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-xs font-bold text-zinc-700">No battery payment records in {locationLabel}</p>
            </div>
          ) : (
            <div className="bird-card overflow-hidden">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer / Party</th>
                    <th>Type</th>
                    <th>Payment Mode</th>
                    <th>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs text-zinc-500">
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="font-bold text-xs text-zinc-900">{p.partyName}</td>
                      <td>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {p.type}
                        </span>
                      </td>
                      <td className="text-xs text-zinc-700 font-bold">{p.paymentMethod}</td>
                      <td className="font-black text-xs text-emerald-700 tabular-nums">
                        ₹{(p.amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* RECEIVE MONEY MODAL */}
      <ReceiveMoneyModal
        isOpen={showReceiveMoneyModal}
        onClose={() => setShowReceiveMoneyModal(false)}
        categoryId="batteries"
        customers={categoryCustomers}
        onSuccess={() => {
          loadCategoryCustomers();
          loadCategoryPayments();
        }}
      />

      {/* QUICK ADJUST MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-xs rounded-2xl shadow-xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-sm text-zinc-900">
                {adjustType === 'ADD' ? 'Add Stock' : 'Reduce Stock'}
              </h3>
              <button onClick={() => setAdjustingProduct(null)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAdjust} className="space-y-3">
              <div>
                <span className="text-xs text-zinc-500 font-medium">Model:</span>
                <p className="font-bold text-xs text-zinc-900">{adjustingProduct.name}</p>
                <p className="text-[11px] text-zinc-400">Current: {adjustingProduct.displayQty ?? adjustingProduct.currentStock ?? 0} pcs</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Pieces to {adjustType === 'ADD' ? 'Add' : 'Remove'} *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  placeholder="e.g. 10"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold text-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setAdjustingProduct(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={adjustLoading} className="btn-primary font-bold">
                  {adjustLoading ? 'Updating...' : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD BATTERY MODEL MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-sm text-zinc-900">+ Add Battery Model</h3>
              <button onClick={() => setShowManualModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBatterySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Battery Model Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Xiaomi BN56 / Redmi 9A Battery"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Xiaomi, Apple, Vivo, Oppo, Realme"
                  value={manualBrand}
                  onChange={(e) => setManualBrand(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={manualPurchasePrice}
                    onChange={(e) => setManualPurchasePrice(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Selling Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={manualSellingPrice}
                    onChange={(e) => setManualSellingPrice(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Initial Stock (pcs) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    min="1"
                    value={manualMinStock}
                    onChange={(e) => setManualMinStock(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setShowManualModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={addingManual} className="btn-primary font-bold">
                  {addingManual ? 'Saving...' : 'Save Battery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODEL MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-sm text-zinc-900">Edit Battery Model</h3>
              <button onClick={() => setEditingProduct(null)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Selling Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setEditingProduct(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={updatingProduct} className="btn-primary font-bold">
                  {updatingProduct ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-sm text-zinc-900">+ Add Battery Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Star Electronics / Battery Hub"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Mobile Number (10 digits)</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Opening Khata Due (₹)</label>
                <input
                  type="number"
                  value={newCustOpeningBal}
                  onChange={(e) => setNewCustOpeningBal(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={addingCust} className="btn-primary font-bold">
                  {addingCust ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BASIC INVOICE MODAL */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        sale={selectedInvoice}
        business={activeBusiness}
      />

      {/* OCR BILL SCAN STOCK INTAKE MODAL */}
      <CategoryScanStockModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        category="Batteries"
        partType="Battery"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['category-hub'] });
          loadBatteriesData();
        }}
      />
    </div>
  );
};

export default BatteriesStockPage;
