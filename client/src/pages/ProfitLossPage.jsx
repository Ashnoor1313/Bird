import React, { useState, useEffect } from 'react';
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
  Table as TableIcon,
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
  const { activeBusinessId, activeBusiness } = useBusiness();
  const { locations, activeLocationId, selectLocation } = useLocation();
  const { isAdmin, user } = useAuth();
  const { addToast } = useToast();

  // Active Filters
  const [period, setPeriod] = useState('monthly'); // 'today' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'custom'
  const [selectedQuarter, setSelectedQuarter] = useState('quarterly'); // 'quarterly' | 'q1' | 'q2' | 'q3' | 'q4'
  const [selectedHalfYear, setSelectedHalfYear] = useState('half-yearly'); // 'half-yearly' | 'h1' | 'h2'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('statement'); // 'statement' | 'bills' | 'customers' | 'products' | 'comparison'

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
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">Access Restricted to Admin / Owner</h2>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          Financial Profit & Loss reports, purchase costs, and store margins are protected and accessible only by Business Owners & Administrators.
        </p>
        <div className="pt-2 text-xs font-semibold text-zinc-400">
          Current Logged-in Role: <span className="text-zinc-700 font-bold">{user?.role}</span>
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
    <div className="p-3 sm:p-6 space-y-5 max-w-7xl mx-auto pb-28 lg:pb-12 print:p-0">
      {/* Top Header Card */}
      <div className="bird-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                👑 Admin Financials
              </span>
              <span>•</span>
              <span className="text-zinc-700 font-bold">{activeBusiness?.name}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 mt-1 flex items-center gap-2">
              <span>Profit & Loss (P&L) Accounting</span>
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              Comprehensive real-time profitability across individual bills, customers, weeks, months, quarters, and half-years.
            </p>
          </div>

          {/* Action buttons & Print */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={fetchPnlSummary} className="btn-secondary" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button onClick={handleExportExcel} disabled={exporting} className="btn-secondary">
              {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-zinc-600" />}
              <span>Export P&L Excel</span>
            </button>

            <button onClick={handlePrintStatement} className="btn-secondary">
              <Printer className="w-3.5 h-3.5 text-zinc-600" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {/* Filters Bar: Period Selector + Branch Filter */}
        <div className="pt-3 border-t border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Period Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
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
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1 mr-1">
              <Building2 className="w-3.5 h-3.5" /> Branch:
            </span>
            <button
              onClick={() => selectLocation('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
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
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
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
          <div className="pt-2 flex items-center gap-2 text-xs font-semibold">
            <span className="text-zinc-400">Select Quarter:</span>
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
                className={`px-2.5 py-1 rounded-md border transition-colors ${
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
          <div className="pt-2 flex items-center gap-2 text-xs font-semibold">
            <span className="text-zinc-400">Select Half-Year:</span>
            {[
              { id: 'half-yearly', label: 'Current Half-Year' },
              { id: 'h1', label: 'H1 (Jan - Jun)' },
              { id: 'h2', label: 'H2 (Jul - Dec)' },
            ].map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHalfYear(h.id)}
                className={`px-2.5 py-1 rounded-md border transition-colors ${
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
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-xs"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* Primary KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Gross Sales Revenue */}
        <div className="bird-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
            <span>Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            ₹{(summaryData?.totalNetSales || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-zinc-400 font-medium mt-1">
            {summaryData?.invoicesCount || 0} bills • {summaryData?.itemsSoldCount || 0} pcs
          </div>
        </div>

        {/* 2. Cost of Goods Sold (COGS) */}
        <div className="bird-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
            <span>Cost of Goods (COGS)</span>
            <Boxes className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-700 tabular-nums">
            ₹{(summaryData?.totalCOGS || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-zinc-400 font-medium mt-1">
            Product procurement cost
          </div>
        </div>

        {/* 3. Gross Profit & Margin */}
        <div className="bird-card p-4 bg-emerald-50/40 border-emerald-200/80">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-1">
            <span>Gross Profit</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">
              {summaryData?.grossMarginPercent || 0}% Margin
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 tabular-nums">
            ₹{(summaryData?.grossProfit || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Revenue minus Purchase Costs
          </div>
        </div>

        {/* 4. Operating Expenses */}
        <div className="bird-card p-4">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium mb-1">
            <span>Operating Expenses</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            ₹{(summaryData?.totalOperatingExpenses || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-zinc-400 font-medium mt-1">
            Rent, salary, electricity, office
          </div>
        </div>

        {/* 5. Net Profit (Bottomline) */}
        <div className="bird-card p-4 bg-zinc-900 text-white shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Net Operating Profit</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold">
              {summaryData?.netProfitMarginPercent || 0}% Net
            </span>
          </div>
          <div className="text-2xl font-black text-white tabular-nums">
            ₹{(summaryData?.netProfit || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-zinc-400 font-medium mt-1">
            {summaryData?.periodLabel || 'Active Period'}
          </div>
        </div>
      </div>

      {/* Main View Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'statement', label: 'Financial Statement & Trends', icon: BarChart2 },
          { id: 'bills', label: `Per-Bill P&L (${billsData.length || summaryData?.invoicesCount || 0})`, icon: Receipt },
          { id: 'customers', label: `Per-Customer P&L (${customersData.length || 0})`, icon: Users },
          { id: 'products', label: 'Categories & Products Profitability', icon: Layers },
          { id: 'comparison', label: 'Quarterly & Half-Yearly Breakdown', icon: TableIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white border border-zinc-200/80 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL STATEMENT & CHARTS */}
      {activeTab === 'statement' && (
        <div className="space-y-5">
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
        <div className="bird-card p-5 space-y-4">
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

          <div className="overflow-x-auto">
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
      )}

      {/* TAB 3: PER-CUSTOMER PROFITABILITY */}
      {activeTab === 'customers' && (
        <div className="bird-card p-5 space-y-4">
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

          <div className="overflow-x-auto">
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

            <div className="overflow-x-auto">
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

            <div className="overflow-x-auto">
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

            <div className="overflow-x-auto">
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

            {/* Items Table with Selling Rate vs Purchase Cost */}
            <div className="overflow-x-auto">
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
