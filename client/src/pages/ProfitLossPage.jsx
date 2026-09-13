import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Users,
  Boxes,
  Building2,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Search,
  ChevronRight,
  Eye,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  ShieldAlert,
  SlidersHorizontal,
  PieChart as PieIcon,
  BarChart2,
  BarChart3,
  Table as TableIcon,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';

import { useDebounce } from '../hooks/useDebounce';

export const ProfitLossPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusinessId, activeBusiness } = useBusiness();
  const { locations, activeLocationId, selectLocation } = useLocation();
  const { isAdmin, user, setAdminModalOpen } = useAuth();
  const { addToast } = useToast();

  // Active Filters
  const [period, setPeriod] = useState('monthly'); // 'today' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'custom'
  const [selectedQuarter, setSelectedQuarter] = useState('quarterly'); // 'quarterly' | 'q1' | 'q2' | 'q3' | 'q4'
  const [selectedHalfYear, setSelectedHalfYear] = useState('half-yearly'); // 'half-yearly' | 'h1' | 'h2'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const initialTab = searchParams.get('tab');
  const validTabs = ['statement', 'bills', 'customers', 'products', 'comparison'];
  const [activeTab, setActiveTab] = useState(validTabs.includes(initialTab) ? initialTab : 'statement');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    }, { replace: true });
  };

  // Data states
  const [summaryData, setSummaryData] = useState(null);
  const [billsData, setBillsData] = useState([]);
  const [customersData, setCustomersData] = useState([]);
  const [productsData, setProductsData] = useState({ products: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Search & Pagination for Bills
  const [billSearch, setBillSearch] = useState('');
  const debouncedBillSearch = useDebounce(billSearch, 250);
  const [selectedBillForModal, setSelectedBillForModal] = useState(null);

  // Search for Customers
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch, 250);

  // Effective period parameter
  const getEffectivePeriod = () => {
    if (period === 'quarterly') return selectedQuarter;
    if (period === 'half-yearly') return selectedHalfYear;
    return period;
  };

  useEffect(() => {
    if (activeBusinessId && isAdmin) {
      fetchPnlSummary();
    }
  }, [activeBusinessId, activeLocationId, period, selectedQuarter, selectedHalfYear, customStartDate, customEndDate, isAdmin]);

  useEffect(() => {
    if (activeBusinessId && isAdmin) {
      if (activeTab === 'bills') fetchBillsPnl();
      else if (activeTab === 'customers') fetchCustomersPnl();
      else if (activeTab === 'products') fetchProductsPnl();
    }
  }, [activeTab, activeBusinessId, activeLocationId, period, selectedQuarter, selectedHalfYear, debouncedBillSearch]);

  const fetchPnlSummary = async () => {
    setLoading(true);
    try {
      const effPeriod = getEffectivePeriod();
      let url = `/api/reports/pnl/summary?businessId=${activeBusinessId}&period=${effPeriod}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      } else {
        addToast('Failed to load Profit & Loss statement', 'error');
      }
    } catch (err) {
      console.error('Error fetching P&L summary:', err);
      addToast('Error fetching P&L data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillsPnl = async () => {
    try {
      const effPeriod = getEffectivePeriod();
      let url = `/api/reports/pnl/bills?businessId=${activeBusinessId}&period=${effPeriod}&limit=100`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      if (billSearch.trim()) {
        url += `&search=${encodeURIComponent(billSearch.trim())}`;
      }
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBillsData(data.bills || []);
      }
    } catch (err) {
      console.error('Error fetching Bills P&L:', err);
    }
  };

  const fetchCustomersPnl = async () => {
    try {
      const effPeriod = getEffectivePeriod();
      let url = `/api/reports/pnl/customers?businessId=${activeBusinessId}&period=${effPeriod}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomersData(data || []);
      }
    } catch (err) {
      console.error('Error fetching Customers P&L:', err);
    }
  };

  const fetchProductsPnl = async () => {
    try {
      const effPeriod = getEffectivePeriod();
      let url = `/api/reports/pnl/products?businessId=${activeBusinessId}&period=${effPeriod}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProductsData(data || { products: [], categories: [] });
      }
    } catch (err) {
      console.error('Error fetching Products P&L:', err);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const effPeriod = getEffectivePeriod();
      let url = `/api/reports/pnl/export/excel?businessId=${activeBusinessId}&period=${effPeriod}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `BIRD_PnL_${summaryData?.periodLabel?.replace(/\s+/g, '_') || 'Report'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      addToast('Profit & Loss Excel report downloaded!', 'success');
    } catch (err) {
      addToast('Failed to export Excel report', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintStatement = () => {
    window.print();
  };

  // IF NOT ADMIN: Display security restricted screen
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-12 bird-card text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Access Restricted to Admin / Owner</h2>
        <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
          Financial Profit & Loss reports, purchase costs, per-bill margins, and customer profitability are protected and accessible only by Business Owners & Administrators.
        </p>
        <div className="pt-1 text-xs font-semibold text-zinc-400">
          Current Logged-in Role: <span className="text-zinc-700 font-bold">{user?.role || 'EMPLOYEE'}</span>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            className="btn-primary text-xs py-2.5 px-5 font-bold flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shadow-sm"
          >
            <Lock className="w-4 h-4 text-amber-300" />
            <span>Unlock Admin Mode with Password</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="btn-secondary text-xs py-2.5 px-4 font-semibold flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-500" />
            <span>View Store Analytics</span>
          </button>
        </div>
      </div>
    );
  }

  const CHART_COLORS = ['#18181b', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'];

  const filteredCustomers = customersData.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.customerName?.toLowerCase().includes(q) || c.customerPhone?.includes(q);
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto pb-28 lg:pb-12 print:p-0">
      {/* 0. PORTAL NAVIGATION SWITCHER: Analytics vs P&L */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 w-full sm:w-fit">
        <button
          onClick={() => navigate('/reports')}
          className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-white/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Store Analytics</span>
        </button>
        <button
          className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-zinc-950 shadow-xs flex items-center justify-center gap-2"
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>👑 Profit & Loss (P&L)</span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hidden md:inline">
            Per-Bill & Customer
          </span>
        </button>
      </div>

      {/* 1. Top Header Card */}
      <div className="bird-card p-4 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                👑 Admin Financials
              </span>
              <span>•</span>
              <span className="text-zinc-700 font-bold">{activeBusiness?.name}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 mt-0.5 sm:mt-1 flex items-center gap-2">
              <span>Profit & Loss (P&L) Accounting</span>
            </h1>
            <p className="text-xs text-zinc-500 font-medium hidden sm:block">
              Comprehensive real-time profitability across individual bills, customers, weeks, months, quarters, and half-years.
            </p>
          </div>

          {/* Action buttons & Print */}
          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end">
            <button onClick={fetchPnlSummary} className="btn-secondary px-2.5 py-1.5" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button onClick={handleExportExcel} disabled={exporting} className="btn-secondary px-3 py-1.5 text-xs">
              {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-zinc-600" />}
              <span>Export P&L Excel</span>
            </button>

            <button onClick={handlePrintStatement} className="btn-secondary px-3 py-1.5 text-xs hidden sm:inline-flex">
              <Printer className="w-3.5 h-3.5 text-zinc-600" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {/* Filters Bar: Period Selector + Branch Filter */}
        <div className="pt-2.5 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Main Period Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            {[
              { id: 'today', label: 'Today' },
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'quarterly', label: 'Quarterly' },
              { id: 'half-yearly', label: 'Half-Yearly' },
              { id: 'yearly', label: 'Yearly' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  period === p.id
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Location / Branch Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 shrink-0">
            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1 mr-1 shrink-0">
              <Building2 className="w-3.5 h-3.5" /> Branch:
            </span>
            <button
              onClick={() => selectLocation('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors shrink-0 ${
                activeLocationId === 'ALL'
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              }`}
            >
              All Stores (Consolidated)
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => selectLocation(loc.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors shrink-0 ${
                  activeLocationId === loc.id
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-period selectors (for Quarterly, Half-Yearly, Custom) */}
        {period === 'quarterly' && (
          <div className="pt-2 flex items-center gap-2 text-xs font-semibold overflow-x-auto no-scrollbar py-0.5">
            <span className="text-zinc-400 shrink-0">Select Quarter:</span>
            {[
              { id: 'quarterly', label: 'Current Quarter' },
              { id: 'q1', label: 'Q1 (Jan - Mar)' },
              { id: 'q2', label: 'Q2 (Apr - Jun)' },
              { id: 'q3', label: 'Q3 (Jul - Sep)' },
              { id: 'q4', label: 'Q4 (Oct - Dec)' },
            ].map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQuarter(q.id)}
                className={`px-2.5 py-1 rounded-md border transition-colors shrink-0 ${
                  selectedQuarter === q.id
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {period === 'half-yearly' && (
          <div className="pt-2 flex items-center gap-2 text-xs font-semibold overflow-x-auto no-scrollbar py-0.5">
            <span className="text-zinc-400 shrink-0">Select Half-Year:</span>
            {[
              { id: 'half-yearly', label: 'Current Half-Year' },
              { id: 'h1', label: 'H1 (Jan - Jun)' },
              { id: 'h2', label: 'H2 (Jul - Dec)' },
            ].map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHalfYear(h.id)}
                className={`px-2.5 py-1 rounded-md border transition-colors shrink-0 ${
                  selectedHalfYear === h.id
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        )}

        {period === 'custom' && (
          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-semibold bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Start Date:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="p-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-900"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">End Date:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="p-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-900"
              />
            </div>
            <button
              onClick={fetchPnlSummary}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-xs cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* 2. MAIN VIEW TABS NAVIGATION (PROMINENT AT TOP SO USERS NEVER MISS PER-BILL & PER-CUSTOMER) */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        {[
          { id: 'statement', label: 'Financial Statement & Trends', icon: BarChart2 },
          { id: 'bills', label: `Per-Bill P&L (${billsData.length || summaryData?.invoicesCount || 0})`, icon: Receipt },
          { id: 'customers', label: `Per-Customer P&L (${customersData.length || 0})`, icon: Users },
          { id: 'products', label: 'Categories & Products', icon: Layers },
          { id: 'comparison', label: 'Quarterly & Half-Yearly Breakdown', icon: TableIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white border border-zinc-200/80 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL STATEMENT & CHARTS */}
      {activeTab === 'statement' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Primary KPI Metrics Bar (2-col grid on mobile, 5-col on desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {/* 1. Gross Sales Revenue */}
            <div className="bird-card p-3 sm:p-4">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
                <span>Sales Revenue</span>
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-600" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 tabular-nums">
                ₹{(summaryData?.totalNetSales || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-medium mt-1">
                {summaryData?.invoicesCount || 0} bills • {summaryData?.itemsSoldCount || 0} pcs
              </div>
            </div>

            {/* 2. Cost of Goods Sold (COGS) */}
            <div className="bird-card p-3 sm:p-4">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
                <span>Cost of Goods</span>
                <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-zinc-700 tabular-nums">
                ₹{(summaryData?.totalCOGS || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-medium mt-1">
                Procurement cost
              </div>
            </div>

            {/* 3. Gross Profit & Margin */}
            <div className="bird-card p-3 sm:p-4 bg-emerald-50/40 border-emerald-200/80">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-1">
                <span>Gross Profit</span>
                <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">
                  {summaryData?.grossMarginPercent || 0}%
                </span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-950 tabular-nums">
                ₹{(summaryData?.grossProfit || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] sm:text-[11px] text-emerald-700 font-medium mt-1">
                Revenue - Cost
              </div>
            </div>

            {/* 4. Operating Expenses */}
            <div className="bird-card p-3 sm:p-4">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
                <span>Operating Exp.</span>
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 tabular-nums">
                ₹{(summaryData?.totalOperatingExpenses || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-medium mt-1">
                Rent, salaries, bills
              </div>
            </div>

            {/* 5. Net Profit (Bottomline) */}
            <div className="bird-card p-3 sm:p-4 bg-zinc-900 text-white shadow-md col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
                <span>Net Operating Profit</span>
                <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold">
                  {summaryData?.netProfitMarginPercent || 0}% Net
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                ₹{(summaryData?.netProfit || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-medium mt-1">
                {summaryData?.periodLabel || 'Active Period'}
              </div>
            </div>
          </div>
          {/* Main Chart: Revenue vs Cost vs Net Profit */}
          <div className="bird-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">12-Month Revenue, COGS & Profit Trajectory</h3>
                <p className="text-zinc-500 text-xs font-medium mt-0.5">
                  Monthly trend for calendar year {summaryData?.monthlyBreakdown?.[0]?.month ? new Date().getFullYear() : ''}.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-zinc-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 inline-block"></span> Sales Revenue
                </span>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 inline-block"></span> COGS (Cost)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Net Profit
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summaryData?.monthlyBreakdown || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlColorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#18181b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pnlColorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="month" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e4e4e7',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    }}
                    formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Area type="monotone" dataKey="revenue" name="Sales Revenue" stroke="#18181b" strokeWidth={2} fillOpacity={1} fill="url(#pnlColorSales)" />
                  <Area type="monotone" dataKey="cogs" name="COGS" stroke="#a1a1aa" strokeWidth={1.5} fillOpacity={0} />
                  <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#pnlColorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Side by Side: Complete Formal P&L Statement & Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Formal Income Statement */}
            <div className="bird-card p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Income & Expense Statement</h3>
                <p className="text-zinc-500 text-xs font-medium">Official P&L for {summaryData?.periodLabel}</p>
              </div>

              <div className="divide-y divide-zinc-100 text-xs font-medium">
                {/* 1. Revenue */}
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-zinc-700 font-semibold">1. Gross Sales Revenue</span>
                  <span className="font-bold text-zinc-900 tabular-nums">₹{(summaryData?.totalGrossSales || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="py-2 flex items-center justify-between text-zinc-500 pl-3">
                  <span>Less: Customer Discounts</span>
                  <span className="text-rose-600 font-semibold tabular-nums">-₹{(summaryData?.totalDiscount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between bg-zinc-50 px-2 rounded-lg font-bold">
                  <span className="text-zinc-900">Net Sales Revenue</span>
                  <span className="text-zinc-950 tabular-nums">₹{(summaryData?.totalNetSales || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* 2. COGS */}
                <div className="py-2.5 flex items-center justify-between text-zinc-700">
                  <span className="font-semibold">2. Cost of Goods Sold (COGS)</span>
                  <span className="text-rose-600 font-bold tabular-nums">-₹{(summaryData?.totalCOGS || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* 3. Gross Profit */}
                <div className="py-2.5 flex items-center justify-between bg-emerald-50 px-2 rounded-lg font-bold text-emerald-950">
                  <span>3. Gross Profit (Margin: {summaryData?.grossMarginPercent || 0}%)</span>
                  <span className="text-emerald-950 tabular-nums">₹{(summaryData?.grossProfit || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* 4. Operating Expenses */}
                <div className="py-2.5 flex items-center justify-between text-zinc-700">
                  <span className="font-semibold">4. Operating Expenses</span>
                  <span className="text-rose-600 font-bold tabular-nums">-₹{(summaryData?.totalOperatingExpenses || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* 5. Net Profit */}
                <div className="py-3 flex items-center justify-between bg-zinc-900 text-white px-3 rounded-xl font-black text-sm">
                  <span>5. Net Operating Profit</span>
                  <span className="text-emerald-400 tabular-nums">₹{(summaryData?.netProfit || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Operating Expenses Breakdown */}
            <div className="bird-card p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Operating Expenses Distribution</h3>
                <p className="text-zinc-500 text-xs font-medium">Categorized shop & store costs</p>
              </div>

              <div className="space-y-2">
                {Object.entries(summaryData?.expenseCategories || {}).map(([cat, amt]) => {
                  const percent = summaryData?.totalOperatingExpenses > 0 ? ((amt / summaryData.totalOperatingExpenses) * 100).toFixed(1) : 0;
                  return (
                    <div key={cat} className="p-2 bg-zinc-50 rounded-xl border border-zinc-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
                        <span className="font-semibold text-zinc-800">{cat}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-400 font-medium">{percent}%</span>
                        <span className="font-bold text-zinc-900 tabular-nums">₹{amt.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Store-wise Consolidated Breakdown (when Consolidated view is selected) */}
          {activeLocationId === 'ALL' && summaryData?.storeBreakdown?.length > 0 && (
            <div className="bird-card p-5 space-y-3">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Branch & Location Profitability Comparison</h3>
                <p className="text-zinc-500 text-xs font-medium">Individual performance across all branches</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                      <th className="pb-2">Branch / Store</th>
                      <th className="pb-2 text-right">Bills</th>
                      <th className="pb-2 text-right">Revenue (₹)</th>
                      <th className="pb-2 text-right">COGS (₹)</th>
                      <th className="pb-2 text-right">Gross Profit (₹)</th>
                      <th className="pb-2 text-right">Expenses (₹)</th>
                      <th className="pb-2 text-right font-bold text-zinc-900">Net Profit (₹)</th>
                      <th className="pb-2 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {summaryData.storeBreakdown.map((s) => (
                      <tr key={s.locationId} className="hover:bg-zinc-50/80">
                        <td className="py-2.5 font-bold text-zinc-900">
                          {s.name} <span className="text-[10px] text-zinc-400 font-normal">({s.type})</span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-zinc-600">{s.salesCount}</td>
                        <td className="py-2.5 text-right font-semibold text-zinc-900 tabular-nums">₹{s.revenue.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-medium text-zinc-600 tabular-nums">₹{s.cogs.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-700 tabular-nums">₹{s.grossProfit.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-medium text-rose-600 tabular-nums">₹{s.expenses.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-black text-zinc-950 tabular-nums">₹{s.netProfit.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-bold text-emerald-800">{s.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PER-BILL PROFIT & LOSS (INVOICE-LEVEL PROFITABILITY) */}
      {activeTab === 'bills' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Quick Summary Strip for Bills */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bird-card p-2.5 sm:p-3 text-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium block">Total Bills</span>
              <span className="text-sm sm:text-lg font-bold text-zinc-900 tabular-nums">
                {billsData.length || summaryData?.invoicesCount || 0}
              </span>
            </div>
            <div className="bird-card p-2.5 sm:p-3 text-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium block">Total Revenue</span>
              <span className="text-sm sm:text-lg font-bold text-zinc-900 tabular-nums">
                ₹{(summaryData?.totalNetSales || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bird-card p-2.5 sm:p-3 text-center bg-emerald-50/50 border-emerald-200">
              <span className="text-[10px] sm:text-xs text-emerald-700 font-medium block">Gross Margin</span>
              <span className="text-sm sm:text-lg font-bold text-emerald-800 tabular-nums">
                {summaryData?.grossMarginPercent || 0}%
              </span>
            </div>
          </div>

          <div className="bird-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Per-Bill Profit & Loss Ledger</h3>
              <p className="text-zinc-500 text-xs font-medium">Exact selling price vs purchase cost for each issued bill</p>
            </div>

            {/* Search Bill No or Customer */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Bill # or Customer..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
              {billSearch && (
                <button
                  type="button"
                  onClick={() => setBillSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* MOBILE VIEW: Per-Bill Cards */}
          <div className="block md:hidden space-y-3">
            {billsData.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400 font-medium">No bills found for the selected period.</div>
            ) : (
              billsData.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-2.5 shadow-2xs"
                >
                  {/* Top Row: Bill No & Margin */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-zinc-900">#{b.billNo}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {new Date(b.saleDate).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-black text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {b.profitMargin}% Margin
                    </span>
                  </div>

                  {/* Customer & Branch */}
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-zinc-800">{b.customerName}</span>
                      {b.customerPhone && (
                        <span className="text-[10px] text-zinc-400 font-medium ml-1.5">
                          ({b.customerPhone})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-semibold bg-white px-2 py-0.5 rounded border border-zinc-200">
                      {b.locationName}
                    </span>
                  </div>

                  {/* Financial Metrics Strip: Revenue, COGS, Profit */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-white rounded-lg border border-zinc-200/80 text-center">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-medium block">Revenue</span>
                      <span className="text-xs font-bold text-zinc-900 tabular-nums">₹{b.total.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-medium block">Cost (COGS)</span>
                      <span className="text-xs font-medium text-zinc-600 tabular-nums">₹{b.cogs.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 font-bold block">Gross Profit</span>
                      <span className="text-xs font-black text-emerald-700 tabular-nums">+₹{b.grossProfit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => setSelectedBillForModal(b)}
                    className="w-full py-2 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-zinc-600" />
                    <span>View Line Items & Purchase Costs</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP VIEW: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                  <th className="pb-2.5">Bill No & Date</th>
                  <th className="pb-2.5">Customer</th>
                  <th className="pb-2.5">Branch</th>
                  <th className="pb-2.5 text-right">Revenue (₹)</th>
                  <th className="pb-2.5 text-right">COGS (₹)</th>
                  <th className="pb-2.5 text-right">Gross Profit (₹)</th>
                  <th className="pb-2.5 text-right">Margin %</th>
                  <th className="pb-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {billsData.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3">
                      <div className="font-bold text-zinc-900">#{b.billNo}</div>
                      <div className="text-[10px] text-zinc-400">{new Date(b.saleDate).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td className="py-3 font-semibold text-zinc-800">
                      <div>{b.customerName}</div>
                      {b.customerPhone && <div className="text-[10px] text-zinc-400">{b.customerPhone}</div>}
                    </td>
                    <td className="py-3 text-zinc-600 font-medium">{b.locationName}</td>
                    <td className="py-3 text-right font-bold text-zinc-900 tabular-nums">₹{b.total.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-medium text-zinc-600 tabular-nums">₹{b.cogs.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-bold text-emerald-700 tabular-nums">
                      +₹{b.grossProfit.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {b.profitMargin}%
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setSelectedBillForModal(b)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Items Breakdown</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* TAB 3: PER-CUSTOMER PROFITABILITY */}
      {activeTab === 'customers' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Quick Summary Strip for Customers */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bird-card p-2.5 sm:p-3 text-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium block">Total Customers</span>
              <span className="text-sm sm:text-lg font-bold text-zinc-900 tabular-nums">
                {customersData.length || 0}
              </span>
            </div>
            <div className="bird-card p-2.5 sm:p-3 text-center">
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium block">Total Gross Profit</span>
              <span className="text-sm sm:text-lg font-bold text-zinc-900 tabular-nums">
                ₹{(summaryData?.grossProfit || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bird-card p-2.5 sm:p-3 text-center bg-emerald-50/50 border-emerald-200">
              <span className="text-[10px] sm:text-xs text-emerald-700 font-medium block">Store Margin</span>
              <span className="text-sm sm:text-lg font-bold text-emerald-800 tabular-nums">
                {summaryData?.grossMarginPercent || 0}%
              </span>
            </div>
          </div>

          <div className="bird-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Per-Customer Profitability Ranking</h3>
              <p className="text-zinc-500 text-xs font-medium">Ranked by total profit generated for your business</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Customer..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* MOBILE VIEW: Per-Customer Cards */}
          <div className="block md:hidden space-y-3">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400 font-medium">No customers found.</div>
            ) : (
              filteredCustomers.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-2.5 shadow-2xs"
                >
                  {/* Top: Rank, Name & Margin */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-extrabold text-xs text-zinc-900">{c.customerName}</div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                          {c.customerPhone || 'Walk-in'} • {c.locationName}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-black text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {c.profitMargin}% Margin
                    </span>
                  </div>

                  {/* Metrics Strip */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-white rounded-lg border border-zinc-200/80 text-center">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-medium block">Total Revenue</span>
                      <span className="text-xs font-bold text-zinc-900 tabular-nums">₹{c.totalRevenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-medium block">Total Cost</span>
                      <span className="text-xs font-medium text-zinc-600 tabular-nums">₹{c.totalCOGS.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 font-bold block">Profit Earned</span>
                      <span className="text-xs font-black text-emerald-700 tabular-nums">₹{c.grossProfit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Footer: Bills & Khata Due */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/60">
                    <span className="text-[11px] text-zinc-500 font-medium">
                      Bills: <strong className="text-zinc-800">{c.billsCount}</strong>
                    </span>
                    <div className="text-[11px]">
                      <span className="text-zinc-400 font-medium">Khata Due: </span>
                      <span className={`font-extrabold tabular-nums ${(c.moneyToReceive || 0) > 0 ? 'text-amber-700' : 'text-zinc-600'}`}>
                        ₹{(c.moneyToReceive || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP VIEW: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                  <th className="pb-2.5"># Rank</th>
                  <th className="pb-2.5">Customer Name</th>
                  <th className="pb-2.5 text-right">Bills</th>
                  <th className="pb-2.5 text-right">Total Revenue (₹)</th>
                  <th className="pb-2.5 text-right">Total Cost (₹)</th>
                  <th className="pb-2.5 text-right font-bold text-emerald-800">Profit Generated (₹)</th>
                  <th className="pb-2.5 text-right">Margin %</th>
                  <th className="pb-2.5 text-right">Khata Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredCustomers.map((c, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 font-black text-zinc-400">{idx + 1}</td>
                    <td className="py-3">
                      <div className="font-bold text-zinc-900">{c.customerName}</div>
                      <div className="text-[10px] text-zinc-400">{c.customerPhone || 'Walk-in'} • {c.locationName}</div>
                    </td>
                    <td className="py-3 text-right font-medium text-zinc-600">{c.billsCount}</td>
                    <td className="py-3 text-right font-bold text-zinc-900 tabular-nums">₹{c.totalRevenue.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-medium text-zinc-600 tabular-nums">₹{c.totalCOGS.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-black text-emerald-800 tabular-nums">
                      ₹{c.grossProfit.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-800">{c.profitMargin}%</td>
                    <td className="py-3 text-right font-semibold text-amber-800 tabular-nums">
                      ₹{(c.moneyToReceive || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* TAB 4: CATEGORY & PRODUCT PROFITABILITY */}
      {activeTab === 'products' && (
        <div className="space-y-5">
          {/* Categories Profitability Cards */}
          <div className="bird-card p-5 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Category Profitability Breakdown</h3>
              <p className="text-zinc-500 text-xs font-medium">Which categories generate the highest margin & profit</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {productsData.categories?.map((cat, idx) => (
                <div key={idx} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-900">{cat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">
                      {cat.margin}% Margin
                    </span>
                  </div>
                  <div className="text-lg font-black text-zinc-950 tabular-nums">
                    ₹{cat.grossProfit.toLocaleString('en-IN')} <span className="text-[10px] text-zinc-400 font-medium">Profit</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex justify-between font-medium pt-1 border-t border-zinc-200/60">
                    <span>Revenue: ₹{cat.revenue.toLocaleString('en-IN')}</span>
                    <span>{cat.quantitySold} pcs sold</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products Profitability Table */}
          <div className="bird-card p-5 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Individual Spare-Parts Profitability</h3>
              <p className="text-zinc-500 text-xs font-medium">Product-by-product profitability</p>
            </div>

            {/* MOBILE VIEW FOR PRODUCTS */}
            <div className="block md:hidden space-y-2.5">
              {productsData.products?.slice(0, 30).map((p, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-zinc-900">{p.name}</div>
                      <div className="text-[10px] text-zinc-500 font-medium">{p.category} • {p.quantitySold} pcs sold</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      {p.margin}% Margin
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-white rounded-lg border border-zinc-200/60 text-center text-xs">
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Revenue</span>
                      <span className="font-bold text-zinc-900 tabular-nums">₹{p.revenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Cost</span>
                      <span className="font-medium text-zinc-600 tabular-nums">₹{p.cogs.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-700 font-bold block">Profit</span>
                      <span className="font-black text-emerald-700 tabular-nums">₹{p.grossProfit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW FOR PRODUCTS */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                    <th className="pb-2">Spare Part Name</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2 text-right">Qty Sold</th>
                    <th className="pb-2 text-right">Revenue (₹)</th>
                    <th className="pb-2 text-right">Cost (₹)</th>
                    <th className="pb-2 text-right font-bold text-emerald-800">Gross Profit (₹)</th>
                    <th className="pb-2 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {productsData.products?.slice(0, 30).map((p, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/80">
                      <td className="py-2.5 font-bold text-zinc-900">{p.name}</td>
                      <td className="py-2.5 text-zinc-500">{p.category}</td>
                      <td className="py-2.5 text-right font-medium">{p.quantitySold}</td>
                      <td className="py-2.5 text-right font-semibold text-zinc-900 tabular-nums">₹{p.revenue.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right font-medium text-zinc-600 tabular-nums">₹{p.cogs.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right font-black text-emerald-800 tabular-nums">₹{p.grossProfit.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-800">{p.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: QUARTERLY & HALF-YEARLY BREAKDOWN */}
      {activeTab === 'comparison' && (
        <div className="space-y-5">
          {/* Quarterly Breakdown Table */}
          <div className="bird-card p-5 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Quarterly P&L Summary (Q1, Q2, Q3, Q4)</h3>
              <p className="text-zinc-500 text-xs font-medium">Performance broken down across financial quarters</p>
            </div>

            {/* MOBILE VIEW FOR QUARTERLY */}
            <div className="block md:hidden space-y-2.5">
              {summaryData?.quarterlyBreakdown?.map((q, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-zinc-900">{q.quarter}</span>
                    <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {q.margin}% Margin
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-white rounded-lg border border-zinc-200/60 text-center text-xs">
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Revenue</span>
                      <span className="font-bold text-zinc-900 tabular-nums">₹{q.revenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">COGS</span>
                      <span className="font-medium text-zinc-600 tabular-nums">₹{q.cogs.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-700 font-bold block">Net Profit</span>
                      <span className="font-black text-emerald-700 tabular-nums">₹{q.netProfit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW FOR QUARTERLY */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                    <th className="pb-2.5">Quarter</th>
                    <th className="pb-2.5 text-right">Revenue (₹)</th>
                    <th className="pb-2.5 text-right">COGS (₹)</th>
                    <th className="pb-2.5 text-right">Gross Profit (₹)</th>
                    <th className="pb-2.5 text-right">Expenses (₹)</th>
                    <th className="pb-2.5 text-right font-bold text-zinc-900">Net Profit (₹)</th>
                    <th className="pb-2.5 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {summaryData?.quarterlyBreakdown?.map((q, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/80">
                      <td className="py-3 font-bold text-zinc-900">{q.quarter}</td>
                      <td className="py-3 text-right font-bold tabular-nums">₹{q.revenue.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-medium text-zinc-600 tabular-nums">₹{q.cogs.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-semibold text-emerald-700 tabular-nums">₹{q.grossProfit.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-medium text-rose-600 tabular-nums">₹{q.expenses.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-black text-zinc-950 tabular-nums">₹{q.netProfit.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-bold text-emerald-800">{q.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Half-Yearly Breakdown Table */}
          <div className="bird-card p-5 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Half-Yearly P&L Summary (H1 vs H2)</h3>
              <p className="text-zinc-500 text-xs font-medium">6-month consolidated performance</p>
            </div>

            {/* MOBILE VIEW FOR HALF-YEARLY */}
            <div className="block md:hidden space-y-2.5">
              {summaryData?.halfYearlyBreakdown?.map((h, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-zinc-900">{h.halfYear}</span>
                    <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {h.margin}% Margin
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-white rounded-lg border border-zinc-200/60 text-center text-xs">
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Revenue</span>
                      <span className="font-bold text-zinc-900 tabular-nums">₹{h.revenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">COGS</span>
                      <span className="font-medium text-zinc-600 tabular-nums">₹{h.cogs.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-700 font-bold block">Net Profit</span>
                      <span className="font-black text-emerald-700 tabular-nums">₹{h.netProfit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW FOR HALF-YEARLY */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                    <th className="pb-2.5">Period</th>
                    <th className="pb-2.5 text-right">Revenue (₹)</th>
                    <th className="pb-2.5 text-right">COGS (₹)</th>
                    <th className="pb-2.5 text-right">Gross Profit (₹)</th>
                    <th className="pb-2.5 text-right">Expenses (₹)</th>
                    <th className="pb-2.5 text-right font-bold text-zinc-900">Net Profit (₹)</th>
                    <th className="pb-2.5 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {summaryData?.halfYearlyBreakdown?.map((h, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/80">
                      <td className="py-3 font-bold text-zinc-900">{h.halfYear}</td>
                      <td className="py-3 text-right font-bold tabular-nums">₹{h.revenue.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-medium text-zinc-600 tabular-nums">₹{h.cogs.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-semibold text-emerald-700 tabular-nums">₹{h.grossProfit.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-medium text-rose-600 tabular-nums">₹{h.expenses.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-black text-zinc-950 tabular-nums">₹{h.netProfit.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-bold text-emerald-800">{h.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BILL LINE-ITEMS PROFIT BREAKDOWN MODAL */}
      {selectedBillForModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Invoice #{selectedBillForModal.billNo} Itemized Profit
                </h3>
                <p className="text-xs text-zinc-500">
                  {selectedBillForModal.customerName} • {new Date(selectedBillForModal.saleDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedBillForModal(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Summary Banner */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-500">Total Bill: </span>
                <span className="font-bold text-zinc-900">₹{selectedBillForModal.total.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-zinc-500">Total Cost (COGS): </span>
                <span className="font-bold text-zinc-900">₹{selectedBillForModal.cogs.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-emerald-700 font-bold">Gross Profit: </span>
                <span className="font-black text-emerald-800">₹{selectedBillForModal.grossProfit.toLocaleString('en-IN')} ({selectedBillForModal.profitMargin}%)</span>
              </div>
            </div>

            {/* MOBILE VIEW: Line Items Cards */}
            <div className="block md:hidden space-y-2.5">
              {selectedBillForModal.items?.map((item, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-zinc-900">{item.productName}</div>
                      {(item.model || item.quality) && (
                        <div className="text-[10px] text-zinc-400 font-medium">
                          {item.model} • {item.quality}
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      {item.lineMargin}% Margin
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-lg border border-zinc-200/80">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Selling Rate × Qty</span>
                      <span className="font-bold text-zinc-900">₹{item.unitPrice} × {item.quantity} = ₹{item.lineTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Purchase Cost</span>
                      <span className="font-medium text-zinc-600">₹{item.purchasePrice} × {item.quantity} = ₹{item.lineCost.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/50">
                    <span className="font-bold text-emerald-800">Net Line Profit:</span>
                    <span className="font-black text-emerald-700 tabular-nums">+₹{item.lineProfit.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                    <th className="pb-2">Item Description</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Sell Rate</th>
                    <th className="pb-2 text-right">Purchase Cost</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-right">Total Cost</th>
                    <th className="pb-2 text-right font-bold text-emerald-800">Profit (₹)</th>
                    <th className="pb-2 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {selectedBillForModal.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/80">
                      <td className="py-2.5">
                        <div className="font-bold text-zinc-900">{item.productName}</div>
                        {(item.model || item.quality) && (
                          <div className="text-[10px] text-zinc-400">{item.model} • {item.quality}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium">{item.quantity}</td>
                      <td className="py-2.5 text-right font-medium">₹{item.unitPrice}</td>
                      <td className="py-2.5 text-right text-zinc-500 font-medium">₹{item.purchasePrice}</td>
                      <td className="py-2.5 text-right font-bold text-zinc-900">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right text-zinc-500">₹{item.lineCost.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right font-black text-emerald-700">₹{item.lineProfit.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-800">{item.lineMargin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setSelectedBillForModal(null)}
                className="btn-primary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLossPage;
