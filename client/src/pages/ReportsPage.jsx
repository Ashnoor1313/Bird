import React, { useState, useMemo } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Calendar,
  Layers,
  RefreshCw,
  Award,
  DollarSign,
  Download,
  Building2,
  Boxes,
  Smartphone,
  BatteryCharging,
  Search,
  Filter,
  Sparkles,
  X,
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

import { useQuery } from '@tanstack/react-query';
import { PageSkeletonLoader } from '../components/common/SkeletonLoader';

export const ReportsPage = () => {
  const { activeBusinessId, activeBusiness } = useBusiness();
  const { activeLocationId, activeLocation, locations, selectLocation } = useLocation();
  const { addToast } = useToast();

  // Filter States
  const [timeRange, setTimeRange] = useState('7D'); // '7D', '15D', '1M', '3M', '6M', '1Y', 'ALL', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

  // View States
  const [activeChartTab, setActiveChartTab] = useState('GROWTH'); // 'GROWTH', 'CATEGORY_TREND', 'PAYMENTS'
  const [topItemsLimit, setTopItemsLimit] = useState(5); // 5, 10, 15, 25, 'CUSTOM'
  const [customLimitInput, setCustomLimitInput] = useState('5');
  const [categoryViewTab, setCategoryViewTab] = useState('BOTH'); // 'BOTH', 'FOLDERS', 'BATTERIES'
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // TanStack Query: Load reports
  const {
    data,
    isLoading: loading,
    isFetching,
    refetch: fetchReports,
  } = useQuery({
    queryKey: ['reports-analytics', activeBusinessId, activeLocationId, timeRange, customStartDate, customEndDate],
    queryFn: async () => {
      let url = `/api/reports/analytics?businessId=${activeBusinessId}&timeRange=${timeRange}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      if (timeRange === 'CUSTOM' && customStartDate) {
        url += `&startDate=${customStartDate}`;
        if (customEndDate) url += `&endDate=${customEndDate}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load store reports');
      return res.json();
    },
    enabled: !!activeBusinessId,
  });

  const handleExportReportExcel = async () => {
    setExporting(true);
    try {
      let url = `/api/products/export/excel?businessId=${activeBusinessId}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const locLabel = activeLocation ? activeLocation.name.replace(/\s+/g, '_') : 'Consolidated';
      a.download = `BIRD_${locLabel}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      addToast('Report exported as Excel!', 'success');
    } catch (err) {
      addToast('Failed to export Excel report', 'error');
    } finally {
      setExporting(false);
    }
  };

  const effectiveLimit = topItemsLimit === 'CUSTOM' ? parseInt(customLimitInput, 10) || 5 : topItemsLimit;

  // Filtered Top Products
  const filteredFolders = useMemo(() => {
    if (!data?.topFolders) return [];
    let list = data.topFolders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list.slice(0, effectiveLimit);
  }, [data?.topFolders, searchQuery, effectiveLimit]);

  const filteredBatteries = useMemo(() => {
    if (!data?.topBatteries) return [];
    let list = data.topBatteries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list.slice(0, effectiveLimit);
  }, [data?.topBatteries, searchQuery, effectiveLimit]);

  if (loading && !data) {
    return <PageSkeletonLoader />;
  }

  const timeRangeLabels = {
    '7D': 'Past 7 Days (1 Week)',
    '15D': 'Past 15 Days',
    '1M': 'Past 30 Days (1 Month)',
    '3M': 'Past 90 Days (3 Months)',
    '6M': 'Past 180 Days (6 Months)',
    '1Y': 'Past 365 Days (1 Year)',
    'ALL': 'All-Time Record',
    'CUSTOM': 'Custom Date Range',
  };

  const isGrowthPositive = (data?.salesGrowthPct ?? 0) >= 0;

  return (
    <div className="p-2.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600" /> STORE ANALYTICS
              </span>
              <span className="text-xs text-zinc-400 font-medium">•</span>
              <span className="text-xs font-bold text-zinc-600 truncate max-w-[160px] sm:max-w-none">{activeBusiness?.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-zinc-900 mt-1 uppercase">
              {activeLocation ? activeLocation.name : 'Store Performance Reports'}
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 font-medium mt-0.5">
              Live sales growth, profit analysis, stock valuations, and Folders & Batteries metrics.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={handleExportReportExcel}
              disabled={exporting}
              className="btn-secondary py-1.5 px-3 sm:py-2 sm:px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-zinc-700" />}
              <span>Export</span>
            </button>

            <button
              onClick={() => fetchReports()}
              className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors border border-zinc-200/80 shadow-2xs"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* TIME INTERVAL BUTTONS (Touch Scrollable on Mobile) */}
        <div className="pt-3 border-t border-zinc-100 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          {/* Time Range Pills */}
          <div className="-mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1 mr-0.5 shrink-0">
              <Calendar className="w-3 h-3 text-zinc-500" /> Period:
            </span>

            {[
              { id: '7D', label: '1W (7D)' },
              { id: '15D', label: '15D' },
              { id: '1M', label: '1M' },
              { id: '3M', label: '3M' },
              { id: '6M', label: '6M' },
              { id: '1Y', label: '1Y' },
              { id: 'ALL', label: 'All-Time' },
            ].map((t) => {
              const active = timeRange === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTimeRange(t.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}

            <button
              onClick={() => setShowCustomDateModal(!showCustomDateModal)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
                timeRange === 'CUSTOM'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>Custom</span>
            </button>
          </div>

          {/* Location Switcher Pills */}
          <div className="-mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1 mr-0.5 shrink-0">
              <Building2 className="w-3 h-3 text-zinc-500" /> Branch:
            </span>

            <button
              onClick={() => selectLocation('ALL')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all ${
                activeLocationId === 'ALL'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              All Stores
            </button>

            {locations?.map((loc) => {
              const isSelected = activeLocationId === loc.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => selectLocation(loc.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <span>{loc.type === 'GODOWN' ? '🏭' : '🏪'}</span>
                  <span>{loc.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Modal */}
        {showCustomDateModal && (
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/90 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="text-xs font-bold text-zinc-700">Custom Dates:</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input py-1 px-2 text-xs rounded-lg bg-white border border-zinc-300 w-full"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input py-1 px-2 text-xs rounded-lg bg-white border border-zinc-300 w-full"
              />
            </div>
            <button
              onClick={() => {
                if (customStartDate) {
                  setTimeRange('CUSTOM');
                  setShowCustomDateModal(false);
                } else {
                  addToast('Please choose a start date', 'error');
                }
              }}
              className="btn-primary py-1.5 px-3 text-xs font-bold w-full sm:w-auto"
            >
              Apply Range
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. PRIMARY FINANCIAL KPI CARDS WITH GROWTH RATE */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* TOTAL SALES REVENUE */}
        <div className="bird-card p-3 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" /> Sales
            </span>
            <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
              isGrowthPositive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {isGrowthPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              <span>{Math.abs(data?.salesGrowthPct ?? 0)}%</span>
            </span>
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-black text-zinc-900 tabular-nums mt-1.5 sm:mt-2 truncate">
            ₹{(data?.totalSalesAmount || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-zinc-500 mt-1 truncate">
            <span className="text-zinc-700 font-bold">{data?.salesCount || 0} bills</span>
            <span>•</span>
            <span className="text-zinc-400">{timeRangeLabels[timeRange] || 'Period'}</span>
          </div>
        </div>

        {/* ESTIMATED PROFIT & MARGIN */}
        <div className="bird-card p-3 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" /> Profit
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {data?.overallMargin || 0}% Margin
            </span>
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-black text-emerald-950 tabular-nums mt-1.5 sm:mt-2 truncate">
            ₹{(data?.grossProfit || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-zinc-500 mt-1 truncate">
            <span>Net: <strong className="text-zinc-800">₹{(data?.netProfit || 0).toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {/* MONEY TO RECEIVE & PAY */}
        <div className="bird-card p-3 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600" /> Receivables
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
              Khata
            </span>
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-black text-purple-950 tabular-nums mt-1.5 sm:mt-2 truncate">
            ₹{(data?.totalReceivables || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-zinc-500 mt-1 truncate">
            <span>Payables: <strong className="text-rose-700">₹{(data?.totalPayables || 0).toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {/* PHYSICAL STOCK VALUATION */}
        <div className="bird-card p-3 sm:p-5 bg-white border border-zinc-200 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Boxes className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" /> Stock Value
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              Live
            </span>
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-black text-zinc-900 tabular-nums mt-1.5 sm:mt-2 truncate">
            ₹{(data?.totalStockValue || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-zinc-500 mt-1 truncate">
            <span className="text-zinc-800 font-bold">{(data?.totalStockPcs || 0).toLocaleString('en-IN')} pcs in inventory</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN COLORED PERFORMANCE GRAPH */}
      {/* ========================================================================= */}
      <div className="bird-card p-3.5 sm:p-6 bg-white border border-zinc-200 shadow-2xs space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 sm:pb-3 border-b border-zinc-100">
          <div>
            <span className="text-[10px] sm:text-xs font-extrabold text-blue-600 uppercase tracking-wider block">
              {timeRangeLabels[timeRange]} Trend Analysis
            </span>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-0.5">
              {activeChartTab === 'GROWTH' && '📈 Sales Revenue & Profit Trajectory'}
              {activeChartTab === 'CATEGORY_TREND' && 'Folders vs Batteries Revenue'}
              {activeChartTab === 'PAYMENTS' && '💳 Payment Mode Breakdown'}
            </h3>
          </div>

          {/* Graph View Selector (Mobile horizontal scrollable) */}
          <div className="-mx-2 px-2 sm:mx-0 sm:px-0 flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveChartTab('GROWTH')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                activeChartTab === 'GROWTH'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-blue-600" />
              <span>Sales & Profit</span>
            </button>

            <button
              onClick={() => setActiveChartTab('CATEGORY_TREND')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                activeChartTab === 'CATEGORY_TREND'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-3 h-3 text-emerald-600" />
              <span>Folders vs Batteries</span>
            </button>

            <button
              onClick={() => setActiveChartTab('PAYMENTS')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                activeChartTab === 'PAYMENTS'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Wallet className="w-3 h-3 text-purple-600" />
              <span>Cash & UPI</span>
            </button>
          </div>
        </div>

        {/* The Colored Recharts Area / Bar Component */}
        <div className="h-60 sm:h-80 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            {activeChartTab === 'GROWTH' ? (
              <AreaChart data={data?.timelineData || []} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSalesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorProfitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPurchasesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10, fontWeight: 600 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  stroke="#71717a"
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    color: '#ffffff',
                    borderColor: '#27272a',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    fontWeight: '600',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  formatter={(val, name) => [`₹${Number(val).toLocaleString('en-IN')}`, name]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '6px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSalesGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProfitGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  name="Purchases"
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#colorPurchasesGradient)"
                />
              </AreaChart>
            ) : activeChartTab === 'CATEGORY_TREND' ? (
              <AreaChart data={data?.timelineData || []} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFolders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBatteries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10, fontWeight: 600 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  stroke="#71717a"
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    color: '#ffffff',
                    borderColor: '#27272a',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    fontWeight: '600',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  formatter={(val, name) => [`₹${Number(val).toLocaleString('en-IN')}`, name]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '6px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="foldersSales"
                  name="Folders (₹)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorFolders)"
                />
                <Area
                  type="monotone"
                  dataKey="batteriesSales"
                  name="Batteries (₹)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorBatteries)"
                />
              </AreaChart>
            ) : (
              <BarChart
                data={[
                  { name: 'Cash', amount: data?.cashSales || 0, fill: '#10b981' },
                  { name: 'UPI/QR', amount: data?.upiSales || 0, fill: '#3b82f6' },
                  { name: 'Khata Due', amount: data?.creditDueSales || 0, fill: '#f59e0b' },
                ]}
                margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10, fontWeight: 600 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={38} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', color: '#fff', borderRadius: '0.75rem', fontSize: '11px' }}
                  formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={36}>
                  <Cell fill="#10b981" />
                  <Cell fill="#3b82f6" />
                  <Cell fill="#f59e0b" />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. THE TWO CORE CATEGORIES PERFORMANCE SHOWCASE (FOLDERS & BATTERIES ONLY) */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight uppercase flex items-center gap-1.5">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-800" /> Category Hubs (Folders & Batteries)
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 font-medium">
              Performance breakdown strictly focused on Folders and Batteries.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
          {/* FOLDERS CATEGORY CARD */}
          <div className="bird-card p-4 sm:p-5 bg-gradient-to-br from-blue-50/40 via-white to-white border border-blue-200/90 shadow-2xs rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <Smartphone className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-zinc-900 uppercase tracking-tight">Folders & Displays</h3>
                  <span className="text-[10px] font-bold text-blue-700">Display Panels • Touch Assemblies</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-3">
              <div className="p-2.5 bg-white rounded-xl border border-blue-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Sales</span>
                <p className="text-base sm:text-lg font-black text-blue-900 tabular-nums mt-0.5 truncate">
                  ₹{(data?.folders?.totalSales || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-blue-600 font-bold">{data?.folders?.billsCount || 0} bills</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-blue-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Sold</span>
                <p className="text-base sm:text-lg font-black text-zinc-900 tabular-nums mt-0.5 truncate">
                  {(data?.folders?.piecesSold || 0).toLocaleString('en-IN')}{' '}
                  <span className="text-xs text-zinc-400 font-bold">pcs</span>
                </p>
                <span className="text-[10px] text-zinc-500 font-semibold">Volume</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-blue-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Gross Profit</span>
                <p className="text-base sm:text-lg font-black text-emerald-700 tabular-nums mt-0.5 truncate">
                  ₹{(data?.folders?.profit || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">{data?.folders?.marginPct || 0}% margin</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-blue-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Stock Value</span>
                <p className="text-base sm:text-lg font-black text-zinc-900 tabular-nums mt-0.5 truncate">
                  ₹{(data?.folders?.stockValue || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-zinc-500 font-bold truncate block">{(data?.folders?.stockPcs || 0).toLocaleString('en-IN')} pcs in stock</span>
              </div>
            </div>
          </div>

          {/* BATTERIES CATEGORY CARD */}
          <div className="bird-card p-4 sm:p-5 bg-gradient-to-br from-emerald-50/40 via-white to-white border border-emerald-200/90 shadow-2xs rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <BatteryCharging className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-zinc-900 uppercase tracking-tight">Batteries & Cells</h3>
                  <span className="text-[10px] font-bold text-emerald-700">Li-ion Cells • High Capacity Packs</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-3">
              <div className="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Sales</span>
                <p className="text-base sm:text-lg font-black text-emerald-950 tabular-nums mt-0.5 truncate">
                  ₹{(data?.batteries?.totalSales || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">{data?.batteries?.billsCount || 0} bills</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Sold</span>
                <p className="text-base sm:text-lg font-black text-zinc-900 tabular-nums mt-0.5 truncate">
                  {(data?.batteries?.piecesSold || 0).toLocaleString('en-IN')}{' '}
                  <span className="text-xs text-zinc-400 font-bold">pcs</span>
                </p>
                <span className="text-[10px] text-zinc-500 font-semibold">Volume</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Gross Profit</span>
                <p className="text-base sm:text-lg font-black text-emerald-700 tabular-nums mt-0.5 truncate">
                  ₹{(data?.batteries?.profit || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">{data?.batteries?.marginPct || 0}% margin</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase block truncate">Stock Value</span>
                <p className="text-base sm:text-lg font-black text-zinc-900 tabular-nums mt-0.5 truncate">
                  ₹{(data?.batteries?.stockValue || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-zinc-500 font-bold truncate block">{(data?.batteries?.stockPcs || 0).toLocaleString('en-IN')} pcs in stock</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TOP SELLING PRODUCTS SHOWCASE (PER CATEGORY WITH LIMIT SELECTOR) */}
      {/* ========================================================================= */}
      <div className="bird-card p-3.5 sm:p-6 bg-white border border-zinc-200 shadow-2xs space-y-3 sm:space-y-4">
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-600" /> BEST MOVING PARTS
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-0.5 uppercase">
              🏆 Top Selling Products Leaderboard
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-500 font-medium">
              Pieces sold, total revenue, and profit per model.
            </p>
          </div>

          {/* Filter Toolbar (Touch scrollable) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Category View Tabs */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold shrink-0">
              <button
                onClick={() => setCategoryViewTab('BOTH')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                  categoryViewTab === 'BOTH' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCategoryViewTab('FOLDERS')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  categoryViewTab === 'FOLDERS' ? 'bg-white text-blue-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>Folders</span>
              </button>
              <button
                onClick={() => setCategoryViewTab('BATTERIES')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  categoryViewTab === 'BATTERIES' ? 'bg-white text-emerald-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>Batteries</span>
              </button>
            </div>

            {/* Item Limit Selector */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold shrink-0">
              <span className="text-[10px] text-zinc-400 font-semibold px-1">Show:</span>
              {[5, 10, 15, 25].map((lim) => (
                <button
                  key={lim}
                  onClick={() => setTopItemsLimit(lim)}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    topItemsLimit === lim
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {lim}
                </button>
              ))}

              <button
                onClick={() => setTopItemsLimit('CUSTOM')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  topItemsLimit === 'CUSTOM'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Limit Input */}
            {topItemsLimit === 'CUSTOM' && (
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-0.5 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={customLimitInput}
                  onChange={(e) => setCustomLimitInput(e.target.value)}
                  className="w-12 text-xs font-bold text-slate-900 text-center outline-none"
                  placeholder="10"
                />
                <span className="text-[10px] text-slate-400 font-bold">items</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Search Bar */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spare parts model name (e.g. 11 Pro, Note 10, C11)..."
            className="w-full pl-8.5 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* TOP SELLING PRODUCTS TABLES (GRID OF 2 COLUMNS ON DESKTOP, 1 COLUMN ON MOBILE) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5">
          {/* 1. TOP SELLING FOLDERS */}
          {(categoryViewTab === 'BOTH' || categoryViewTab === 'FOLDERS') && (
            <div className="bird-card p-3 sm:p-4 bg-white border border-blue-200/80 rounded-2xl shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 uppercase tracking-tight">
                    Top Folders Models
                  </h4>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {filteredFolders.length} models
                </span>
              </div>

              {filteredFolders.length === 0 ? (
                <div className="text-center py-6 text-xs font-semibold text-zinc-400">
                  No folders sales found.
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 text-[9px] sm:text-[10px] uppercase font-bold text-zinc-400">
                        <th className="py-1.5 px-1">#</th>
                        <th className="py-1.5 px-1.5">Model</th>
                        <th className="py-1.5 px-1.5 text-center">Pcs</th>
                        <th className="py-1.5 px-1.5 text-right">Revenue</th>
                        <th className="py-1.5 px-1.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {filteredFolders.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-2 px-1 font-bold">
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md inline-flex items-center justify-center text-[9px] sm:text-[10px] font-black ${
                              idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                              idx === 1 ? 'bg-zinc-200 text-zinc-800' :
                              idx === 2 ? 'bg-amber-50 text-amber-800' :
                              'bg-zinc-100 text-zinc-600'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2 px-1.5 font-bold text-zinc-900 max-w-[110px] sm:max-w-[160px] truncate">
                            {item.name}
                          </td>
                          <td className="py-2 px-1.5 text-center font-extrabold text-blue-700 tabular-nums whitespace-nowrap">
                            {item.piecesSold}{' '}
                            <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-400">pcs</span>
                          </td>
                          <td className="py-2 px-1.5 text-right font-black text-zinc-900 tabular-nums whitespace-nowrap">
                            ₹{Number(item.totalRevenue || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-1.5 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            +₹{Number(item.grossProfit || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. TOP SELLING BATTERIES */}
          {(categoryViewTab === 'BOTH' || categoryViewTab === 'BATTERIES') && (
            <div className="bird-card p-3 sm:p-4 bg-white border border-emerald-200/80 rounded-2xl shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 uppercase tracking-tight">
                    Top Batteries Models
                  </h4>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {filteredBatteries.length} models
                </span>
              </div>

              {filteredBatteries.length === 0 ? (
                <div className="text-center py-6 text-xs font-semibold text-zinc-400">
                  No battery sales found.
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 text-[9px] sm:text-[10px] uppercase font-bold text-zinc-400">
                        <th className="py-1.5 px-1">#</th>
                        <th className="py-1.5 px-1.5">Model</th>
                        <th className="py-1.5 px-1.5 text-center">Pcs</th>
                        <th className="py-1.5 px-1.5 text-right">Revenue</th>
                        <th className="py-1.5 px-1.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {filteredBatteries.map((item, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="py-2 px-1 font-bold">
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md inline-flex items-center justify-center text-[9px] sm:text-[10px] font-black ${
                              idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                              idx === 1 ? 'bg-zinc-200 text-zinc-800' :
                              idx === 2 ? 'bg-amber-50 text-amber-800' :
                              'bg-zinc-100 text-zinc-600'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2 px-1.5 font-bold text-zinc-900 max-w-[110px] sm:max-w-[160px] truncate">
                            {item.name}
                          </td>
                          <td className="py-2 px-1.5 text-center font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
                            {item.piecesSold}{' '}
                            <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-400">pcs</span>
                          </td>
                          <td className="py-2 px-1.5 text-right font-black text-zinc-900 tabular-nums whitespace-nowrap">
                            ₹{Number(item.totalRevenue || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-1.5 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            +₹{Number(item.grossProfit || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
