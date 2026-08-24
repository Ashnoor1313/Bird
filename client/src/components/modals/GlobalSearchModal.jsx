import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { Search, X, Package, Receipt, Users, Building2, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GlobalSearchModal = ({ isOpen, onClose }) => {
  const { activeBusinessId } = useBusiness();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], sales: [], customers: [], suppliers: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim() || !activeBusinessId) {
      setResults({ products: [], sales: [], customers: [], suppliers: [] });
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeBusinessId]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const q = encodeURIComponent(query.trim());
      const [prodRes, saleRes, custRes, suppRes] = await Promise.all([
        fetch(`/api/products?businessId=${activeBusinessId}&search=${q}`),
        fetch(`/api/sales?businessId=${activeBusinessId}&search=${q}`),
        fetch(`/api/customers?businessId=${activeBusinessId}&search=${q}`),
        fetch(`/api/suppliers?businessId=${activeBusinessId}&search=${q}`),
      ]);

      const [products, sales, customers, suppliers] = await Promise.all([
        prodRes.json(),
        saleRes.json(),
        custRes.json(),
        suppRes.json(),
      ]);

      setResults({
        products: Array.isArray(products) ? products.slice(0, 5) : [],
        sales: Array.isArray(sales) ? sales.slice(0, 5) : [],
        customers: Array.isArray(customers) ? customers.slice(0, 5) : [],
        suppliers: Array.isArray(suppliers) ? suppliers.slice(0, 5) : [],
      });
    } catch (err) {
      console.error('Search Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-start justify-center p-4 pt-16 animate-fade-in">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Input Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parts, bills, customer phone, suppliers..."
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none text-sm font-medium border-none p-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[11px] font-bold px-2 py-1 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-md transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results Area */}
        <div className="p-3 max-h-[60vh] overflow-y-auto space-y-3">
          {loading && <div className="text-center py-6 text-slate-500 text-xs font-semibold">Searching records...</div>}

          {!loading && !query && (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              Type product name, brand, model, customer name, bill number, or supplier to search across BIRD.
            </div>
          )}

          {!loading && query && (
            <>
              {/* Products */}
              {results.products.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-500" /> Products & Parts
                  </div>
                  <div className="space-y-1">
                    {results.products.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onClose();
                          navigate('/stock');
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{p.name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{p.model} • {p.quality}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-900 tabular-nums">₹{Number(p.sellingPrice || 0).toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-400 font-medium">Stock: {p.currentStock} pcs</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bills */}
              {results.sales.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-500" /> Sales Bills
                  </div>
                  <div className="space-y-1">
                    {results.sales.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onClose();
                          navigate('/sales');
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">#{s.billNo} — {s.customerName}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{new Date(s.saleDate).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right font-bold text-slate-900 text-xs tabular-nums">₹{Number(s.total || 0).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers */}
              {results.customers.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" /> Customers
                  </div>
                  <div className="space-y-1">
                    {results.customers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onClose();
                          navigate('/customers');
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{c.name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{c.phone || 'No phone'}</div>
                        </div>
                        <div className="text-right font-bold text-amber-700 text-xs tabular-nums">Due: ₹{Number(c.moneyToReceive || 0).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suppliers */}
              {results.suppliers.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" /> Suppliers
                  </div>
                  <div className="space-y-1">
                    {results.suppliers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onClose();
                          navigate('/suppliers');
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{s.name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{s.phone || 'No phone'}</div>
                        </div>
                        <div className="text-right font-bold text-slate-900 text-xs tabular-nums">Payable: ₹{Number(s.moneyToPay || 0).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.products.length === 0 && results.sales.length === 0 && results.customers.length === 0 && results.suppliers.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  No matching items found for "{query}".
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

