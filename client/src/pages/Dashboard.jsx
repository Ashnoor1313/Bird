import React, { useState } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useDashboardData } from '../hooks/useApiQueries';
import { PageSkeletonLoader } from '../components/common/SkeletonLoader';
import { InvoiceModal } from '../components/modals/InvoiceModal';
import {
  RefreshCw,
  Smartphone,
  BatteryCharging,
  ChevronRight,
  Boxes,
  Package,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Camera,
  FileSpreadsheet,
  AlertTriangle,
  Receipt,
  Users,
  CreditCard,
  ShoppingBag,
  AlertCircle,
  Truck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────────
   GODOWN DASHBOARD – Pure Inventory & Warehouse View
   ───────────────────────────────────────────────────────────────────────────── */
const GodownDashboard = ({ data, activeBusiness, activeLocation, locations, selectLocation, activeLocationId, isFetching, refetch }) => {
  const navigate = useNavigate();

  const foldersStockPcs   = data?.foldersStockPcs ?? 0;
  const foldersStockValue = data?.foldersStockValue ?? 0;
  const batteriesStockPcs   = data?.batteriesStockPcs ?? 0;
  const batteriesStockValue = data?.batteriesStockValue ?? 0;
  const totalStockPcs   = data?.totalStockPcs ?? (foldersStockPcs + batteriesStockPcs);
  const totalStockValue = data?.stockValue ?? (foldersStockValue + batteriesStockValue);
  const lowStockCount   = data?.lowStockCount ?? 0;
  const outOfStockCount = data?.outOfStockCount ?? 0;
  const totalSuppliers  = data?.totalSuppliers ?? 0;
  const moneyToPay      = data?.moneyToPay ?? 0;
  const totalPurchases  = data?.totalPurchases ?? 0;
  const todayPurchases  = data?.todayPurchases ?? 0;
  const locationName    = activeLocation ? activeLocation.name : 'Central Godown';

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24 lg:pb-8">

      {/* ENTERPRISE LOCATION SWITCHER BAR */}
      <div className="bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl gap-1 w-full sm:w-auto">
            {locations && locations.map((loc) => {
              const isSelected = activeLocationId === loc.id || (activeLocationId === 'ALL' && loc.type === 'GODOWN');
              const isGodownType = loc.type === 'GODOWN';
              return (
                <button
                  key={loc.id}
                  onClick={() => selectLocation(loc.id)}
                  className={`group relative flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isSelected ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-slate-400'}`}></span>
                  <span className="flex items-center gap-1.5">
                    <span>{isGodownType ? '🏭' : '🏪'}</span>
                    <span className="truncate">{loc.name}</span>
                  </span>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    isSelected
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-200/90 text-slate-500'
                  }`}>
                    {isGodownType ? 'Godown' : 'Store'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200 shrink-0 cursor-pointer flex items-center justify-center"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-blue-50 text-blue-800 border-blue-200">🏭 CENTRAL GODOWN</span>
            <span className="text-xs text-zinc-400 font-medium">•</span>
            <span className="text-xs font-bold text-zinc-500">{activeBusiness?.name || 'BIRD Mobile Spare-Parts'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 mt-1 uppercase">{locationName}</h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">Centralized warehouse inventory — stock levels, purchase orders & supplier payables</p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-2.5 sm:px-4 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-tight">Warehouse Status</span>
            <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1 mt-0.5 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live & Active
            </span>
          </div>
        </div>
      </div>

      {/* INVENTORY KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bird-card p-3.5 sm:p-5 bg-gradient-to-br from-blue-50/80 to-white border border-blue-200/80 shadow-2xs hover:border-blue-400 transition-all">
          <div className="flex items-center gap-1.5 text-blue-700 mb-1.5">
            <Boxes className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Stock</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-blue-950 tabular-nums">
            {totalStockPcs.toLocaleString('en-IN')}<span className="text-xs sm:text-sm font-semibold text-blue-500 ml-1">pcs</span>
          </p>
          <div className="text-[11px] font-semibold text-blue-600 mt-1">₹{totalStockValue.toLocaleString('en-IN')} value</div>
        </div>

        <div className={`bird-card p-3.5 sm:p-5 border shadow-2xs hover:border-amber-400 transition-all ${lowStockCount > 0 ? 'bg-gradient-to-br from-amber-50/80 to-white border-amber-200/80' : 'bg-white border-zinc-200'}`}>
          <div className="flex items-center gap-1.5 text-amber-700 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Low Stock</span>
          </div>
          <p className={`text-xl sm:text-3xl font-black tabular-nums ${lowStockCount > 0 ? 'text-amber-950' : 'text-zinc-900'}`}>{lowStockCount}</p>
          <div className="text-[11px] font-semibold text-amber-600 mt-1">products to reorder</div>
        </div>

        <div className={`bird-card p-3.5 sm:p-5 border shadow-2xs hover:border-rose-400 transition-all ${outOfStockCount > 0 ? 'bg-gradient-to-br from-rose-50/80 to-white border-rose-200/80' : 'bg-white border-zinc-200'}`}>
          <div className="flex items-center gap-1.5 text-rose-700 mb-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Out of Stock</span>
          </div>
          <p className={`text-xl sm:text-3xl font-black tabular-nums ${outOfStockCount > 0 ? 'text-rose-950' : 'text-zinc-900'}`}>{outOfStockCount}</p>
          <div className="text-[11px] font-semibold text-rose-600 mt-1">products depleted</div>
        </div>

        <div className="bird-card p-3.5 sm:p-5 bg-gradient-to-br from-purple-50/80 to-white border border-purple-200/80 shadow-2xs hover:border-purple-400 transition-all">
          <div className="flex items-center gap-1.5 text-purple-700 mb-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Money to Pay</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-purple-950 tabular-nums">₹{moneyToPay.toLocaleString('en-IN')}</p>
          <div className="text-[11px] font-semibold text-purple-600 mt-1">{totalSuppliers} suppliers</div>
        </div>
      </div>

      {/* PROCUREMENT STRIP */}
      <div className="bird-card p-4 sm:p-5 bg-white border border-zinc-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Procurement</p>
            <p className="text-lg sm:text-xl font-black text-zinc-900 tabular-nums">₹{totalPurchases.toLocaleString('en-IN')}</p>
            <p className="text-[11px] font-semibold text-zinc-400 mt-0.5">Today: <span className="text-zinc-700">₹{todayPurchases.toLocaleString('en-IN')}</span></p>
          </div>
        </div>
        <button onClick={() => navigate('/orders')} className="btn-secondary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 w-full sm:w-auto justify-center">
          <ShoppingBag className="w-3.5 h-3.5" /><span>View Purchase Orders</span><ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* CATEGORY INVENTORY CARDS */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900">Category Hubs</h2>
          <p className="text-xs text-zinc-500 font-medium">Stock quantities, inventory values & quick OCR intake</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* FOLDERS */}
          <div className="bird-card p-4 sm:p-6 bg-gradient-to-br from-white via-white to-blue-50/20 border border-zinc-200/90 hover:border-blue-500/80 transition-all space-y-4 shadow-2xs">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">FOLDERS</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Displays & LCDs</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">Folder screens & touch assemblies</p>
                </div>
              </div>
              <button onClick={() => navigate('/folders')} className="hidden sm:inline-flex btn-secondary py-1.5 px-2.5 text-xs font-bold items-center gap-1 shrink-0">
                <span>Manage</span><ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-blue-50/70 p-3 sm:p-4 rounded-xl border border-blue-200/60">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Stock In Hand</span>
                <p className="text-xl sm:text-2xl font-black text-blue-950 tabular-nums mt-0.5">
                  {foldersStockPcs.toLocaleString('en-IN')}<span className="text-xs text-blue-500 font-semibold ml-1">pcs</span>
                </p>
              </div>
              <div className="bg-zinc-50 p-3 sm:p-4 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Stock Value</span>
                <p className="text-xl sm:text-2xl font-black text-zinc-900 tabular-nums mt-0.5">
                  ₹{foldersStockValue.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
              <button onClick={() => navigate('/folders')} className="btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs">
                <Package className="w-3.5 h-3.5" /><span>Manage Stock</span>
              </button>
              <button onClick={() => navigate('/folders')} className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" /><span>Upload Stock</span>
              </button>
            </div>
          </div>

          {/* BATTERIES */}
          <div className="bird-card p-4 sm:p-6 bg-gradient-to-br from-white via-white to-emerald-50/20 border border-zinc-200/90 hover:border-emerald-500/80 transition-all space-y-4 shadow-2xs">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <BatteryCharging className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">BATTERIES</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Cells & Power</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">Original & OEM battery replacements</p>
                </div>
              </div>
              <button onClick={() => navigate('/batteries')} className="hidden sm:inline-flex btn-secondary py-1.5 px-2.5 text-xs font-bold items-center gap-1 shrink-0">
                <span>Manage</span><ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-emerald-50/70 p-3 sm:p-4 rounded-xl border border-emerald-200/60">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Stock In Hand</span>
                <p className="text-xl sm:text-2xl font-black text-emerald-950 tabular-nums mt-0.5">
                  {batteriesStockPcs.toLocaleString('en-IN')}<span className="text-xs text-emerald-500 font-semibold ml-1">pcs</span>
                </p>
              </div>
              <div className="bg-zinc-50 p-3 sm:p-4 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Stock Value</span>
                <p className="text-xl sm:text-2xl font-black text-zinc-900 tabular-nums mt-0.5">
                  ₹{batteriesStockValue.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
              <button onClick={() => navigate('/batteries')} className="btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs">
                <BatteryCharging className="w-3.5 h-3.5" /><span>Manage Stock</span>
              </button>
              <button onClick={() => navigate('/batteries')} className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" /><span>Upload Stock</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GODOWN QUICK TOOLS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button onClick={() => navigate('/orders')} className="bird-card p-3 sm:p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><ShoppingBag className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Purchase Orders</span><span className="text-[10px] text-zinc-400 font-medium">Procurement</span></div>
        </button>
        <button onClick={() => navigate('/import')} className="bird-card p-3 sm:p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Excel Import</span><span className="text-[10px] text-zinc-400 font-medium">Catalog bulk</span></div>
        </button>
        <button onClick={() => navigate('/suppliers')} className="bird-card p-3 sm:p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left col-span-2 sm:col-span-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Truck className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Suppliers</span><span className="text-[10px] text-zinc-400 font-medium">Khata balances</span></div>
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   STORE DASHBOARD – Full Financial & Business View
   ───────────────────────────────────────────────────────────────────────────── */
const StoreDashboard = ({ data, activeBusiness, activeLocation, locations, selectLocation, activeLocationId, isFetching, refetch }) => {
  const navigate = useNavigate();
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const locationName = activeLocation ? activeLocation.name : 'All Locations (Consolidated)';

  const totalSales      = data?.totalSales ?? 0;
  const todaySales      = data?.todaySales ?? 0;
  const totalBillsCount = data?.totalBillsCount ?? 0;
  const moneyToReceive  = data?.moneyToReceive ?? 0;
  const moneyToPay      = data?.moneyToPay ?? 0;
  const totalCustomers  = data?.totalCustomers ?? 0;
  const totalSuppliers  = data?.totalSuppliers ?? 0;
  const totalPurchases  = data?.totalPurchases ?? 0;
  const todayPurchases  = data?.todayPurchases ?? 0;

  const foldersTotalSales   = data?.foldersTotalSales ?? 0;
  const foldersTodaySales   = data?.foldersTodaySales ?? 0;
  const foldersBillsCount   = data?.foldersBillsCount ?? 0;
  const foldersStockPcs     = data?.foldersStockPcs ?? 0;
  const foldersStockValue   = data?.foldersStockValue ?? 0;
  const foldersReceivables  = data?.foldersReceivables ?? 0;

  const batteriesTotalSales   = data?.batteriesTotalSales ?? 0;
  const batteriesTodaySales   = data?.batteriesTodaySales ?? 0;
  const batteriesBillsCount   = data?.batteriesBillsCount ?? 0;
  const batteriesStockPcs     = data?.batteriesStockPcs ?? 0;
  const batteriesStockValue   = data?.batteriesStockValue ?? 0;
  const batteriesReceivables  = data?.batteriesReceivables ?? 0;

  const recentBills = data?.recentBills || [];

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24 lg:pb-8">

      {/* ENTERPRISE LOCATION SWITCHER BAR */}
      <div className="bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl gap-1 w-full sm:w-auto">
            {locations && locations.map((loc) => {
              const isSelected = activeLocationId === loc.id;
              const isGodownType = loc.type === 'GODOWN';
              return (
                <button
                  key={loc.id}
                  onClick={() => selectLocation(loc.id)}
                  className={`group relative flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isSelected ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-slate-400'}`}></span>
                  <span className="flex items-center gap-1.5">
                    <span>{isGodownType ? '🏭' : '🏪'}</span>
                    <span className="truncate">{loc.name}</span>
                  </span>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    isSelected
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-200/90 text-slate-500'
                  }`}>
                    {isGodownType ? 'Godown' : 'Store'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200 shrink-0 cursor-pointer flex items-center justify-center"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-800 border-emerald-200">🏪 STORE COUNTER</span>
            <span className="text-xs text-zinc-400 font-medium">•</span>
            <span className="text-xs font-bold text-zinc-500">{activeBusiness?.name || 'BIRD Mobile Spare-Parts'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 mt-1 uppercase">{locationName}</h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">Complete store financials, money receivables, supplier payables, and category hubs</p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-2.5 sm:px-4 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-tight">Branch Status</span>
            <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1 mt-0.5 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live & Active
            </span>
          </div>
        </div>
      </div>

      {/* FINANCIAL KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bird-card p-3.5 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Sales</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-zinc-900 tabular-nums">₹{totalSales.toLocaleString('en-IN')}</p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 mt-1 flex-wrap">
            <span className="text-emerald-600 font-bold">Today: ₹{todaySales.toLocaleString('en-IN')}</span>
            <span>•</span>
            <span>{totalBillsCount} bills</span>
          </div>
        </div>

        <div className="bird-card p-3.5 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Receivables</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-emerald-950 tabular-nums">₹{moneyToReceive.toLocaleString('en-IN')}</p>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">{totalCustomers} customers</div>
        </div>

        <div className="bird-card p-3.5 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Payables</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-rose-950 tabular-nums">₹{moneyToPay.toLocaleString('en-IN')}</p>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">{totalSuppliers} suppliers</div>
        </div>

        <div className="bird-card p-3.5 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Purchases</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-zinc-900 tabular-nums">₹{totalPurchases.toLocaleString('en-IN')}</p>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">Today: ₹{todayPurchases.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* CATEGORY MINI-BUSINESSES */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900">Category Hubs</h2>
          <p className="text-xs text-zinc-500 font-medium">Sales, stock breakdown, and billing hubs for Folders and Batteries</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* FOLDERS */}
          <div className="bird-card p-4 sm:p-6 bg-gradient-to-br from-white via-white to-blue-50/20 border border-zinc-200/90 hover:border-blue-500/80 transition-all space-y-4 shadow-2xs">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">FOLDERS</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Displays & LCDs</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">Folder screens & touch assemblies</p>
                </div>
              </div>
              <button onClick={() => navigate('/folders')} className="hidden sm:inline-flex btn-secondary py-1.5 px-2.5 text-xs font-bold items-center gap-1 shrink-0">
                <span>Open Hub</span><ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Sales</span>
                <p className="text-base font-black text-zinc-900 tabular-nums mt-0.5">₹{foldersTotalSales.toLocaleString('en-IN')}</p>
                <span className="text-[10px] font-bold text-blue-600 block mt-0.5 truncate">Today: ₹{foldersTodaySales.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Stock In Hand</span>
                <p className="text-base font-black text-zinc-900 tabular-nums mt-0.5">{foldersStockPcs.toLocaleString('en-IN')} <span className="text-[10px] text-zinc-400 font-medium">pcs</span></p>
                <span className="text-[10px] font-bold text-zinc-500 block mt-0.5 truncate">₹{foldersStockValue.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Bills</span>
                <p className="text-base font-black text-zinc-900 tabular-nums mt-0.5">{foldersBillsCount}</p>
                <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Invoices</span>
              </div>
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Receivables</span>
                <p className="text-base font-black text-purple-900 tabular-nums mt-0.5">₹{foldersReceivables.toLocaleString('en-IN')}</p>
                <span className="text-[10px] font-bold text-purple-600 block mt-0.5">Due</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
              <button onClick={() => navigate('/sales?action=new&category=folders')} className="btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Create Bill</span>
              </button>
              <button onClick={() => navigate('/folders')} className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-zinc-500" /><span>Manage Stock</span>
              </button>
            </div>
          </div>

          {/* BATTERIES */}
          <div className="bird-card p-4 sm:p-6 bg-gradient-to-br from-white via-white to-emerald-50/20 border border-zinc-200/90 hover:border-emerald-500/80 transition-all space-y-4 shadow-2xs">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <BatteryCharging className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">BATTERIES</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Cells & Power</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">Original & OEM battery replacements</p>
                </div>
              </div>
              <button onClick={() => navigate('/batteries')} className="hidden sm:inline-flex btn-secondary py-1.5 px-2.5 text-xs font-bold items-center gap-1 shrink-0">
                <span>Open Hub</span><ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Sales</span>
                <p className="text-base font-black text-zinc-900 tabular-nums mt-0.5">₹{batteriesTotalSales.toLocaleString('en-IN')}</p>
                <span className="text-[10px] font-bold text-emerald-600 block mt-0.5 truncate">Today: ₹{batteriesTodaySales.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Stock In Hand</span>
                <p className="text-base font-black text-zinc-900 tabular-nums mt-0.5">{batteriesStockPcs.toLocaleString('en-IN')} <span className="text-[10px] text-zinc-400 font-medium">pcs</span></p>
                <span className="text-[10px] font-bold text-zinc-500 block mt-0.5 truncate">₹{batteriesStockValue.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Bills</span>
                <p className="text-base font-black text-zinc-900 tabular-nums mt-0.5">{batteriesBillsCount}</p>
                <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Invoices</span>
              </div>
              <div className="bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Receivables</span>
                <p className="text-base font-black text-purple-900 tabular-nums mt-0.5">₹{batteriesReceivables.toLocaleString('en-IN')}</p>
                <span className="text-[10px] font-bold text-purple-600 block mt-0.5">Due</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
              <button onClick={() => navigate('/sales?action=new&category=batteries')} className="btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Create Bill</span>
              </button>
              <button onClick={() => navigate('/batteries')} className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5">
                <BatteryCharging className="w-3.5 h-3.5 text-zinc-500" /><span>Manage Stock</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT SALES BILLS */}
      <div className="bird-card p-4 sm:p-6 bg-white border border-zinc-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm sm:text-base font-black text-zinc-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" /><span>Recent Sales Invoices ({locationName})</span>
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Latest sales bills generated for repair shops and retail customers</p>
          </div>
          <button onClick={() => navigate('/sales')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 self-start sm:self-auto">
            <span>View All Sales & Bills</span><ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentBills.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-zinc-700">No Sales Bills Recorded Yet</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Start by creating a new bill for folders or batteries</p>
            <button onClick={() => navigate('/sales?action=new')} className="btn-primary mt-3 py-1.5 px-3 text-xs font-bold inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /><span>+ Create First Bill</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/80 text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-y border-zinc-200/80">
                  <th className="py-2.5 px-3">Bill No</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-center">Payment</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentBills.map((b) => {
                  const isBattery = b.categoryId && /batter/i.test(b.categoryId);
                  return (
                    <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">{b.billNo}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-zinc-900">{b.customerName}</div>
                        {b.customerPhone && <div className="text-[10px] text-zinc-400 font-medium">{b.customerPhone}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${isBattery ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                          {isBattery ? 'Batteries' : 'Folders'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-zinc-900 tabular-nums">₹{(b.total || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 uppercase">{b.paymentMethod || 'CASH'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => { setSelectedInvoice(b); setShowInvoiceModal(true); }}
                          className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-800 text-[11px] transition-colors"
                        >
                          View Bill
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK OPERATIONS TOOLBAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => navigate('/scan-bill')} className="bird-card p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Camera className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Scan Paper Bill</span><span className="text-[10px] text-zinc-400 font-medium">AI OCR Extraction</span></div>
        </button>
        <button onClick={() => navigate('/import')} className="bird-card p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Excel Import / Export</span><span className="text-[10px] text-zinc-400 font-medium">Bulk Product Catalog</span></div>
        </button>
        <button onClick={() => navigate('/money')} className="bird-card p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Money & Cashbook</span><span className="text-[10px] text-zinc-400 font-medium">Cash, Bank & UPI</span></div>
        </button>
        <button onClick={() => navigate('/reports')} className="bird-card p-3.5 bg-white border border-zinc-200 hover:border-zinc-900 flex items-center gap-3 transition-all text-left">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4" /></div>
          <div><span className="text-xs font-bold text-zinc-900 block">Business Analytics</span><span className="text-[10px] text-zinc-400 font-medium">Profit & Loss Reports</span></div>
        </button>
      </div>

      <InvoiceModal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} sale={selectedInvoice} business={activeBusiness} />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN DASHBOARD – Dispatcher
   ───────────────────────────────────────────────────────────────────────────── */
export const Dashboard = () => {
  const { activeBusiness, activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation, locations, selectLocation } = useLocation();

  const { data, isLoading, isFetching, refetch } = useDashboardData(activeBusinessId, activeLocationId);

  if (isLoading && !data) {
    return <PageSkeletonLoader />;
  }

  const sharedProps = { data, activeBusiness, activeLocation, locations, selectLocation, activeLocationId, isFetching, refetch };

  if (activeLocation?.type === 'GODOWN') {
    return <GodownDashboard {...sharedProps} />;
  }

  return <StoreDashboard {...sharedProps} />;
};



export default Dashboard;
