import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  Search,
  Plus,
  ArrowLeft,
  Download,
  Boxes,
  AlertTriangle,
  ArrowRightLeft,
  History,
  Edit2,
  RefreshCw,
  Minus,
  CheckCircle2,
  X,
} from 'lucide-react';

export const CategoryStockPage = () => {
  const { id: categoryId } = useParams();
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation, locations } = useLocation();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Quick Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD' | 'REMOVE'
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Quick Add Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdQty, setNewProdQty] = useState('0');
  const [newProdRate, setNewProdRate] = useState('');
  const [newProdSellingPrice, setNewProdSellingPrice] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdModel, setNewProdModel] = useState('');
  const [newProdAliases, setNewProdAliases] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);

  const getEffectiveLocationId = () => {
    if (activeLocationId && activeLocationId !== 'ALL') return activeLocationId;
    const store = (locations || []).find(l => l.type === 'STORE');
    return store?.id || (locations || [])[0]?.id;
  };

  useEffect(() => {
    if (activeBusinessId && categoryId) {
      loadCategoryData();
    }
  }, [activeBusinessId, categoryId, activeLocationId]);

  const loadCategoryData = async () => {
    setLoading(true);
    try {
      // Fetch categories to find this category metadata
      const catRes = await fetch(`/api/products/categories?businessId=${activeBusinessId}`);
      if (catRes.ok) {
        const catList = await catRes.json();
        const currentCat = catList.find(c => c.id === categoryId);
        setCategory(currentCat || { id: categoryId, name: 'Stock Category' });
      }

      // Fetch products scoped to this category
      let url = `/api/products?businessId=${activeBusinessId}&categoryId=${categoryId}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }

      const prodRes = await fetch(url);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
      }
    } catch (err) {
      console.error('Failed to load category stock:', err);
      addToast('Failed to load category stock', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCategoryExcel = async () => {
    setExporting(true);
    try {
      const locParam = activeLocationId && activeLocationId !== 'ALL' ? `&locationId=${activeLocationId}` : '';
      const url = `/api/products/export/excel?businessId=${activeBusinessId}&scope=category&categoryId=${categoryId}${locParam}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `BIRD_${category?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Category'}_Stock.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      addToast(`${category?.name || 'Category'} stock exported to Excel!`, 'success');
    } catch (err) {
      addToast('Failed to export Excel file', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleQuickAdjust = async (e) => {
    e.preventDefault();
    if (!adjustingProduct || !adjustQty) return;

    const qtyNumber = parseInt(adjustQty, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      addToast('Please enter a valid quantity', 'error');
      return;
    }

    setAdjustLoading(true);
    try {
      const targetLocId = getEffectiveLocationId();
      const signedQty = adjustType === 'ADD' ? qtyNumber : -qtyNumber;
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          productId: adjustingProduct.id,
          locationId: targetLocId,
          quantity: signedQty,
          type: adjustType === 'ADD' ? 'MANUAL_ADJUSTMENT' : 'DAMAGED',
          note: `Quick stock adjustment (${adjustType === 'ADD' ? '+' : '-'}${qtyNumber})`,
        }),
      });

      if (res.ok) {
        addToast(`Stock updated for ${adjustingProduct.name}`, 'success');
        setAdjustingProduct(null);
        setAdjustQty('');
        loadCategoryData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to update stock', 'error');
      }
    } catch (err) {
      addToast('Failed to update stock', 'error');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      addToast('Model Name is required', 'error');
      return;
    }

    setAddingProduct(true);
    try {
      const targetLocId = getEffectiveLocationId();
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          categoryId: categoryId,
          name: newProdName.trim(),
          model: newProdName.trim(),
          purchasePrice: parseFloat(newProdRate) || 0,
          sellingPrice: parseFloat(newProdSellingPrice || newProdRate) || 0,
          currentStock: parseInt(newProdQty, 10) || 0,
          locationId: targetLocId,
        }),
      });

      if (res.ok) {
        addToast(`Product "${newProdName}" added!`, 'success');
        setShowAddModal(false);
        setNewProdName('');
        setNewProdQty('0');
        setNewProdRate('');
        setNewProdSellingPrice('');
        loadCategoryData();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to create product', 'error');
      }
    } catch (err) {
      addToast('Error creating product', 'error');
    } finally {
      setAddingProduct(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.aliases?.toLowerCase().includes(q)
    );
  });

  const totalCategoryPieces = products.reduce((sum, p) => {
    const qty = activeLocationId && activeLocationId !== 'ALL' ? (p.locationStockQuantity || 0) : p.currentStock;
    return sum + qty;
  }, 0);

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary py-1.5 px-2.5"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCategoryExcel}
            disabled={exporting || products.length === 0}
            className="btn-secondary py-1.5 px-3"
            title="Download Excel for this Category"
          >
            {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-zinc-500" />}
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Category Banner Title */}
      <div className="bird-card p-5 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            {activeLocation ? activeLocation.name : 'Godown'} • Category Stock
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 mt-0.5 uppercase">
            {category?.name || 'Stock Category'}
          </h1>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {products.length} models • {totalCategoryPieces.toLocaleString('en-IN')} total pcs in stock
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
          <Boxes className="w-5 h-5" />
        </div>
      </div>

      {/* Mobile Fast Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search in ${category?.name || 'this category'} (e.g. A15, Note 10, Y21)...`}
          className="w-full pl-10 pr-10 py-2.5 text-xs font-medium text-zinc-900 placeholder:text-zinc-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile Stock Cards List (Clean, minimal typing, large touch targets) */}
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Loading {category?.name} inventory...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-2xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Boxes className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            {search ? `No products matching "${search}"` : `No products in ${category?.name || 'this category'} yet`}
          </h3>
          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
            Add your first mobile spare part into this category with a single tap.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product Now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredProducts.map((p) => {
            const qty = activeLocationId && activeLocationId !== 'ALL' ? (p.locationStockQuantity || 0) : p.currentStock;
            const isLow = qty > 0 && qty <= (p.minStock || 5);
            const isOut = qty <= 0;
            const isNegative = qty < 0;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Product Info */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
                      {p.name}
                    </h3>

                    {/* Stock Status Badge */}
                    {isNegative ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                        ⚠ Negative Stock ({qty} pcs)
                      </span>
                    ) : isOut ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                        🔴 Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        🟡 Low Stock ({qty} pcs)
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        🟢 In Stock
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    {p.model && <span>Model: <strong className="text-slate-700">{p.model}</strong></span>}
                    {p.purchasePrice > 0 && <span>Rate: <strong className="text-slate-700">₹{p.purchasePrice}</strong></span>}
                    {p.sku && <span className="font-mono text-[11px]">SKU: {p.sku}</span>}
                  </div>
                </div>

                {/* Stock Number & Quick Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Available</span>
                    <p className={`text-xl font-black leading-none ${isNegative ? 'text-rose-600' : isOut ? 'text-slate-400' : isLow ? 'text-amber-600' : 'text-blue-600'}`}>
                      {qty} <span className="text-xs font-semibold text-slate-500">pcs</span>
                    </p>
                  </div>

                  {/* Touch Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setAdjustingProduct(p);
                        setAdjustType('ADD');
                        setAdjustQty('10');
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 active:scale-95 transition-transform"
                      title="Add Stock Quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adjust Stock</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Adjust Stock</h3>
                <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{adjustingProduct.name}</p>
              </div>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAdjust} className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustType('ADD')}
                  className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    adjustType === 'ADD'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Stock</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustType('REMOVE')}
                  className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    adjustType === 'REMOVE'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  <span>- Reduce Stock</span>
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Quantity (pcs) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {adjustLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirm Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CREATE PRODUCT MODAL (Short & Simple Form) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">+ Add Product to {category?.name}</h3>
                <p className="text-xs text-slate-500 font-medium">Short mobile-first product entry</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Model Name *</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Samsung A15 Folder"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newProdRate}
                    onChange={(e) => setNewProdRate(e.target.value)}
                    placeholder="1200"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newProdSellingPrice}
                    onChange={(e) => setNewProdSellingPrice(e.target.value)}
                    placeholder="1600"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Quantity (pcs) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newProdQty}
                  onChange={(e) => setNewProdQty(e.target.value)}
                  placeholder="10"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingProduct}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {addingProduct ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Add Product</span>
                </button>

              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CategoryStockPage;
