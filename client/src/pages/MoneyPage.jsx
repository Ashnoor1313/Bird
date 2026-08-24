import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { CustomSelect } from '../components/common/CustomSelect';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  RefreshCw,
  X,
  Trash2,
  Plus,
  Search,
  Receipt,
  Calendar,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { useMoneyBalancesData } from '../hooks/useApiQueries';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';
import { PageSkeletonLoader } from '../components/common/SkeletonLoader';

export const MoneyPage = () => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation } = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Tabs: 'transactions' | 'received' | 'paid' | 'expenses'
  const [activeTab, setActiveTab] = useState('transactions');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);

  // TanStack Query for Balances & Transactions (Instant Cached with SWR)
  const {
    data,
    isLoading: loading,
    isFetching,
    refetch: fetchMoneyData,
  } = useMoneyBalancesData(activeBusinessId, activeLocationId);

  // Modals
  const [showReceiveModal, setShowReceiveModal] = useState(searchParams.get('action') === 'receive');
  const [showPayModal, setShowPayModal] = useState(searchParams.get('action') === 'pay');
  const [showExpenseModal, setShowExpenseModal] = useState(searchParams.get('action') === 'expense');

  // Deleting state
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Forms
  const [receiveForm, setReceiveForm] = useState({ customerName: '', amount: '', notes: '' });
  const [payForm, setPayForm] = useState({ supplierName: '', amount: '', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ category: 'Tea & Snacks', amount: '', notes: '' });

  const handleReceiveMoney = async (e) => {
    e.preventDefault();
    if (!receiveForm.amount || parseFloat(receiveForm.amount) <= 0) {
      addToast('Please enter a valid amount', 'error');
      return;
    }
    try {
      const res = await fetch('/api/money/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...receiveForm,
          businessId: activeBusinessId,
          locationId: activeLocationId !== 'ALL' ? activeLocationId : undefined,
        }),
      });

      if (res.ok) {
        addToast('Payment received & balance updated!', 'success');
        setShowReceiveModal(false);
        setReceiveForm({ customerName: '', amount: '', notes: '' });
        fetchMoneyData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to record receipt', 'error');
      }
    } catch (err) {
      addToast('Error recording receipt', 'error');
    }
  };

  const handlePayMoney = async (e) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      addToast('Please enter a valid amount', 'error');
      return;
    }
    try {
      const res = await fetch('/api/money/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payForm,
          businessId: activeBusinessId,
          locationId: activeLocationId !== 'ALL' ? activeLocationId : undefined,
        }),
      });

      if (res.ok) {
        addToast('Payout recorded & balance updated!', 'success');
        setShowPayModal(false);
        setPayForm({ supplierName: '', amount: '', notes: '' });
        fetchMoneyData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to record payout', 'error');
      }
    } catch (err) {
      addToast('Error recording payout', 'error');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      addToast('Please enter a valid amount', 'error');
      return;
    }
    try {
      const res = await fetch('/api/money/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          businessId: activeBusinessId,
          locationId: activeLocationId !== 'ALL' ? activeLocationId : undefined,
        }),
      });

      if (res.ok) {
        addToast('Expense logged successfully!', 'success');
        setShowExpenseModal(false);
        setExpenseForm({ category: 'Tea & Snacks', amount: '', notes: '' });
        fetchMoneyData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to log expense', 'error');
      }
    } catch (err) {
      addToast('Error logging expense', 'error');
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/money/expenses/${deletingExpense.id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('Expense entry deleted!', 'success');
        setDeletingExpense(null);
        fetchMoneyData();
      } else {
        addToast('Failed to delete expense', 'error');
      }
    } catch (err) {
      addToast('Error deleting expense', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/money/payments/${deletingPayment.id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('Payment entry deleted!', 'success');
        setDeletingPayment(null);
        fetchMoneyData();
      } else {
        addToast('Failed to delete payment', 'error');
      }
    } catch (err) {
      addToast('Error deleting payment', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin mb-3 text-zinc-600" />
        <p className="text-zinc-500 text-xs font-semibold">Loading Money & Expenses...</p>
      </div>
    );
  }

  const totalBalance = data?.totalBalance ?? (
    (data?.balance?.cashBalance || 0) + (data?.balance?.bankBalance || 0) + (data?.balance?.upiBalance || 0)
  );

  const expenses = data?.expenses || [];
  const payments = data?.payments || [];

  const filteredExpenses = expenses.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.category?.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q);
  });

  const filteredPayments = payments.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.partyName?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q)
    );
  });

  const receivedPayments = filteredPayments.filter(p => p.type === 'RECEIVE');
  const paidPayments = filteredPayments.filter(p => p.type === 'PAY');

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-6xl mx-auto pb-24 lg:pb-8">
      {/* Top Header Card */}
      <div className="bird-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
              <span>{activeLocation ? activeLocation.name : 'ALL LOCATIONS'}</span>
              <span>•</span>
              <span className="text-zinc-600 font-bold">CASH FLOW & EXPENSES</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 mt-1 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-zinc-700" />
              <span>Money & Expenses</span>
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              Unified store balance, daily expenses ledger, and payment receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="btn-primary"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>+ Add Expense</span>
            </button>

            <button
              onClick={() => setShowReceiveModal(true)}
              className="btn-secondary"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>Receive Money</span>
            </button>

            <button
              onClick={() => setShowPayModal(true)}
              className="btn-secondary"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
              <span>Pay Money</span>
            </button>
          </div>
        </div>

        {/* Unified Balance Overview Tiles (No Cash/UPI/Bank Bifurcation) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Main Total Balance */}
          <div className="bg-zinc-900 text-white p-3.5 rounded-xl border border-zinc-800 shadow-2xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Total Balance</div>
            <div className="text-2xl font-extrabold mt-0.5 tabular-nums tracking-tight">
              ₹{totalBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Available Net Balance</div>
          </div>

          {/* Shop Expenses */}
          <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase">Total Expenses</div>
            <div className="text-lg font-bold text-rose-700 mt-0.5 tabular-nums">
              ₹{(data?.totalExpenses || expenses.reduce((s, e) => s + (e.amount || 0), 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{expenses.length} expense logs</div>
          </div>

          {/* Total Inflow (Received) */}
          <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase">Money Received</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5 tabular-nums">
              +₹{(data?.totalReceived || payments.filter(p => p.type === 'RECEIVE').reduce((s, p) => s + (p.amount || 0), 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Customer Collections</div>
          </div>

          {/* Total Outflow (Paid) */}
          <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase">Money Paid Out</div>
            <div className="text-lg font-bold text-zinc-900 mt-0.5 tabular-nums">
              -₹{(data?.totalPaid || payments.filter(p => p.type === 'PAY').reduce((s, p) => s + (p.amount || 0), 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Supplier Payments</div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'transactions'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>All Transactions ({filteredPayments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'received'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
          <span>Collections ({receivedPayments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('paid')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'paid'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
          <span>Payouts ({paidPayments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'expenses'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Shop Expenses ({filteredExpenses.length})</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expenses, party name, or notes..."
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

      {/* TAB 1: SHOP EXPENSES SECTION */}
      {activeTab === 'expenses' && (
        <div className="bird-card overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Shop Expenses Ledger</h3>
              <p className="text-[11px] text-zinc-500">Daily shop operating costs (Rent, Tea, Electricity, Courier, Salaries)</p>
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Expense</span>
            </button>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-medium space-y-2">
              <p>No expense entries logged for this store.</p>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="btn-primary mx-auto text-xs"
              >
                + Add First Expense
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* MOBILE VIEW: Expense Cards */}
              <div className="sm:hidden space-y-2.5 p-3">
                {filteredExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="bird-card p-3.5 space-y-2 active:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="badge-neutral font-semibold text-[10px]">
                        {exp.category}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {new Date(exp.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-xs text-zinc-700 font-medium">
                        {exp.notes || <span className="text-zinc-400 italic">No notes</span>}
                      </div>
                      <div className="font-extrabold text-rose-700 text-sm tabular-nums">
                        -₹{(exp.amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-1 border-t border-zinc-100">
                      <button
                        onClick={() => setDeletingExpense(exp)}
                        className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 hover:underline p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP VIEW: Enterprise Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Notes / Description</th>
                      <th>Amount</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td className="text-xs text-zinc-500 font-medium">
                          {new Date(exp.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          <span className="badge-neutral font-semibold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="text-xs text-zinc-700 font-medium">
                          {exp.notes || <span className="text-zinc-400 italic">No notes</span>}
                        </td>
                        <td>
                          <span className="font-bold text-rose-700 text-xs tabular-nums">
                            -₹{(exp.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => setDeletingExpense(exp)}
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete Expense Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL TRANSACTIONS (RECEIPTS + PAYOUTS) */}
      {activeTab === 'transactions' && (
        <div className="bird-card overflow-hidden">
          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-medium">
              No payment transactions recorded for this store.
            </div>
          ) : (
            <div className="space-y-3">
              {/* MOBILE VIEW: Transaction Cards */}
              <div className="sm:hidden space-y-2.5 p-3">
                {filteredPayments.map((p) => {
                  const isReceive = p.type === 'RECEIVE';
                  return (
                    <div
                      key={p.id}
                      className="bird-card p-3.5 space-y-2 active:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className={isReceive ? 'badge-success text-[10px]' : 'badge-neutral text-[10px]'}>
                          {isReceive ? 'Money In' : 'Money Out'}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {new Date(p.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <div className="font-bold text-xs text-zinc-900">{p.partyName}</div>
                          <div className="text-[11px] text-zinc-500">{p.notes || '—'}</div>
                        </div>
                        <div
                          className={`font-extrabold text-sm tabular-nums ${
                            isReceive ? 'text-emerald-700' : 'text-zinc-900'
                          }`}
                        >
                          {isReceive ? `+₹${p.amount?.toLocaleString('en-IN')}` : `-₹${p.amount?.toLocaleString('en-IN')}`}
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1 border-t border-zinc-100">
                        <button
                          onClick={() => setDeletingPayment(p)}
                          className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 hover:underline p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW: Enterprise Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Party Name</th>
                      <th>Notes</th>
                      <th>Amount</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => {
                      const isReceive = p.type === 'RECEIVE';
                      return (
                        <tr key={p.id}>
                          <td className="text-xs text-zinc-500 font-medium">
                            {new Date(p.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td>
                            <span className={isReceive ? 'badge-success' : 'badge-neutral'}>
                              {isReceive ? 'Money In' : 'Money Out'}
                            </span>
                          </td>
                          <td className="font-semibold text-zinc-900 text-xs">
                            {p.partyName}
                          </td>
                          <td className="text-xs text-zinc-500 font-medium">
                            {p.notes || <span className="text-zinc-400 italic">—</span>}
                          </td>
                          <td>
                            <span
                              className={`font-bold text-xs tabular-nums ${
                                isReceive ? 'text-emerald-700' : 'text-zinc-900'
                              }`}
                            >
                              {isReceive ? `+₹${p.amount?.toLocaleString('en-IN')}` : `-₹${p.amount?.toLocaleString('en-IN')}`}
                            </span>
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => setDeletingPayment(p)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete Payment Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* TAB 3: MONEY RECEIVED (COLLECTIONS) */}
      {activeTab === 'received' && (
        <div className="bird-card overflow-hidden">
          {receivedPayments.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-medium">
              No customer receipt collections recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>Notes</th>
                    <th>Amount Received</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs text-zinc-500 font-medium">
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="font-semibold text-zinc-900 text-xs">{p.partyName}</td>
                      <td className="text-xs text-zinc-500 font-medium">{p.notes || '—'}</td>
                      <td className="font-bold text-emerald-700 text-xs tabular-nums">
                        +₹{p.amount?.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => setDeletingPayment(p)}
                          className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 4: MONEY PAID (SUPPLIER PAYOUTS) */}
      {activeTab === 'paid' && (
        <div className="bird-card overflow-hidden">
          {paidPayments.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-medium">
              No supplier payouts recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier Name</th>
                    <th>Notes</th>
                    <th>Amount Paid</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paidPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs text-zinc-500 font-medium">
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="font-semibold text-zinc-900 text-xs">{p.partyName}</td>
                      <td className="text-xs text-zinc-500 font-medium">{p.notes || '—'}</td>
                      <td className="font-bold text-zinc-900 text-xs tabular-nums">
                        -₹{p.amount?.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => setDeletingPayment(p)}
                          className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL: ADD EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-md rounded-2xl shadow-xl p-5 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Add Shop Expense</h3>
                <p className="text-[11px] text-zinc-500">Deducted from store balance</p>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Expense Category *</label>
                <CustomSelect
                  value={expenseForm.category}
                  onChange={(val) => setExpenseForm({ ...expenseForm, category: val })}
                  options={[
                    { value: 'Tea & Snacks', label: '☕ Tea & Refreshments' },
                    { value: 'Shop Rent', label: '🏬 Shop Rent' },
                    { value: 'Electricity Bill', label: '⚡ Electricity & Power' },
                    { value: 'Staff Salary', label: '👤 Staff / Helper Salary' },
                    { value: 'Courier & Transport', label: '🚚 Courier / Delivery' },
                    { value: 'Packaging Material', label: '📦 Boxes & Bubble Wraps' },
                    { value: 'Shop Maintenance', label: '🧹 Cleaning & Maintenance' },
                    { value: 'Other Expense', label: '📝 Other Miscellaneous' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 150"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Note / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Evening tea for guests & technician"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE MONEY */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Receive Customer Payment</h3>
                <p className="text-[11px] text-zinc-500">Adds to store balance & settles customer Khata</p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReceiveMoney} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mobile Care or Rahul"
                  value={receiveForm.customerName}
                  onChange={(e) => setReceiveForm({ ...receiveForm, customerName: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5000"
                  value={receiveForm.amount}
                  onChange={(e) => setReceiveForm({ ...receiveForm, amount: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Received via UPI / Cash in full"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowReceiveModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY MONEY */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Pay Supplier</h3>
                <p className="text-[11px] text-zinc-500">Deducts from store balance & settles supplier dues</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePayMoney} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Mobile Wholesale"
                  value={payForm.supplierName}
                  onChange={(e) => setPayForm({ ...payForm, supplierName: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 10000"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid against bill #402"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE EXPENSE MODAL */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-2xl p-5 space-y-3 shadow-xl animate-fade-in text-center">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Delete Expense Entry?</h3>
            <p className="text-xs text-zinc-500">
              Are you sure you want to delete this expense of <strong>₹{deletingExpense.amount}</strong> ({deletingExpense.category})? This will restore the balance.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button onClick={() => setDeletingExpense(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDeleteExpense}
                disabled={isDeleting}
                className="btn-primary bg-rose-600 hover:bg-rose-700 border-transparent text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE PAYMENT MODAL */}
      {deletingPayment && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-2xl p-5 space-y-3 shadow-xl animate-fade-in text-center">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Delete Payment Record?</h3>
            <p className="text-xs text-zinc-500">
              Are you sure you want to delete payment entry of <strong>₹{deletingPayment.amount}</strong> for <strong>{deletingPayment.partyName}</strong>?
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button onClick={() => setDeletingPayment(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDeletePayment}
                disabled={isDeleting}
                className="btn-primary bg-rose-600 hover:bg-rose-700 border-transparent text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoneyPage;
