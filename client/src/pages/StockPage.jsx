import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { CustomSelect } from '../components/common/CustomSelect';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { CategoryScanStockModal } from '../components/modals/CategoryScanStockModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  History,
  Edit,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  ArrowRightLeft,
  Boxes,
  MapPin,
  CheckCircle2,
  Tag,
  FolderPlus,
  Check,
  Download,
  ScanLine,
  FileSpreadsheet,
  Camera,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const StockPage = () => {
  const { activeBusinessId } = useBusiness();
  const { locations, activeLocationId, activeLocation } = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('');
  const [stockFilter, setStockFilter] = useState(searchParams.get('filter') === 'low' ? 'LOW' : '');

  // Modals
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'new');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  // Category Form State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [editingProduct, setEditingProduct] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [stateTransferProduct, setStateTransferProduct] = useState(null);

  // Stock Quantity Adjustment State
  const [adjLocationId, setAdjLocationId] = useState('');
  const [adjQty, setAdjQty] = useState('');
  const [isConsolidating, setIsConsolidating] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    partType: 'Display',
    variant: '',
    quality: 'WD',
    purchasePrice: '',
    sellingPrice: '',
    mrp: '',
    currentStock: '0',
    minStock: '5',
    warranty: '7 Days Testing Warranty',
    categoryId: '',
    locationId: '',
  });

  // State Transfer Form
  const [transferData, setTransferData] = useState({
    quantity: '1',
    fromState: 'GOOD',
    toState: 'DEFECTIVE',
    note: '',
  });

  useEffect(() => {
    if (activeBusinessId) {
      fetchProducts();
      fetchCategories();
    }
  }, [activeBusinessId, activeLocationId, selectedCategory, selectedQuality, stockFilter, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/products?businessId=${activeBusinessId}`;
      if (activeLocationId && activeLocationId !== 'ALL') url += `&locationId=${activeLocationId}`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (selectedQuality) url += `&quality=${selectedQuality}`;
      if (stockFilter) url += `&stockStatus=${stockFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/products/categories?businessId=${activeBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBusinessId, name: newCategoryName.trim() }),
      });
      if (res.ok) {
        addToast(`Category "${newCategoryName.trim()}" created!`, 'success');
        setNewCategoryName('');
        fetchCategories();
      } else {
        addToast('Failed to create category', 'error');
      }
    } catch (err) {
      addToast('Error creating category', 'error');
    }
  };

  const handleUpdateCategory = async (catId, newName) => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/products/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        addToast('Category renamed successfully!', 'success');
        setEditingCategoryId(null);
        fetchCategories();
      } else {
        addToast('Failed to rename category', 'error');
      }
    } catch (err) {
      addToast('Error updating category', 'error');
    }
  };

  // Delete confirmation modal states
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast(`Category "${deletingCategory.name}" deleted!`, 'success');
        if (selectedCategory === deletingCategory.id) setSelectedCategory('');
        setDeletingCategory(null);
        fetchCategories();
        fetchProducts();
      } else {
        addToast('Failed to delete category', 'error');
      }
    } catch (err) {
      addToast('Error deleting category', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${deletingProduct.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast(`Product "${deletingProduct.name}" deleted!`, 'success');
        if (editingProduct?.id === deletingProduct.id) {
          setShowAddModal(false);
          setEditingProduct(null);
        }
        setDeletingProduct(null);
        fetchProducts();
      } else {
        addToast('Failed to delete product', 'error');
      }
    } catch (err) {
      addToast('Error deleting product', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Duplicate Pre-Check Approval State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [matchingProduct, setMatchingProduct] = useState(null);
  const [isInsertingStock, setIsInsertingStock] = useState(false);

  const handleSaveProduct = async (e, bypassDuplicateCheck = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.name.trim()) {
      addToast('Please enter a product name', 'error');
      return;
    }

    // Pre-check for duplicate matching items if creating a new product
    if (!editingProduct && !bypassDuplicateCheck) {
      try {
        const dupCheckRes = await fetch('/api/products/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: activeBusinessId,
            name: formData.name,
            model: formData.model,
            quality: formData.quality,
            categoryId: formData.categoryId,
            partType: formData.partType,
          }),
        });

        if (dupCheckRes.ok) {
          const dupData = await dupCheckRes.json();
          if (dupData.exists && dupData.existingProduct) {
            setMatchingProduct(dupData.existingProduct);
            setShowDuplicateModal(true);
            return;
          }
        }
      } catch (err) {
        console.error('Duplicate pre-check error:', err);
      }
    }

    executeSaveProduct();
  };

  const executeSaveProduct = async () => {
    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, businessId: activeBusinessId }),
      });

      if (res.ok) {
        if (editingProduct && adjQty && parseInt(adjQty, 10) !== 0) {
          const targetLoc = adjLocationId || locations.find(l => l.type === 'GODOWN')?.id || locations[0]?.id;
          await fetch('/api/stock/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: activeBusinessId,
              productId: editingProduct.id,
              locationId: targetLoc,
              quantity: parseInt(adjQty, 10),
              note: 'Manual stock quantity adjustment during product edit',
            }),
          });
        }
        addToast(editingProduct ? 'Product details & stock quantity updated!' : 'Mobile spare part added!', 'success');
        setShowAddModal(false);
        setShowDuplicateModal(false);
        setMatchingProduct(null);
        setEditingProduct(null);
        setAdjQty('');
        resetForm();
        fetchProducts();
      } else {
        const errJson = await res.json().catch(() => ({}));
        addToast(errJson.error || 'Failed to save product', 'error');
      }
    } catch (err) {
      addToast('Error saving product', 'error');
    }
  };

  const handleInsertIntoExisting = async () => {
    if (!matchingProduct) return;
    setIsInsertingStock(true);

    try {
      const targetQty = parseInt(formData.currentStock || '1', 10);
      const targetLoc = formData.locationId || locations.find(l => l.type === 'GODOWN')?.id || locations[0]?.id;

      // 1. Insert/add stock into existing product
      if (targetQty > 0) {
        await fetch('/api/stock/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: activeBusinessId,
            productId: matchingProduct.id,
            locationId: targetLoc,
            quantity: targetQty,
            note: `Stock quantity inserted into existing catalog item (${matchingProduct.name})`,
          }),
        });
      }

      // 2. Optionally update price if specified on form
      const updatePayload = {};
      if (formData.sellingPrice && parseFloat(formData.sellingPrice) > 0) {
        updatePayload.sellingPrice = parseFloat(formData.sellingPrice);
      }
      if (formData.purchasePrice && parseFloat(formData.purchasePrice) > 0) {
        updatePayload.purchasePrice = parseFloat(formData.purchasePrice);
      }

      if (Object.keys(updatePayload).length > 0) {
        await fetch(`/api/products/${matchingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
      }

      addToast(`Successfully added ${targetQty} pcs to existing item "${matchingProduct.name}" (#${matchingProduct.itemCode})!`, 'success');
      setShowDuplicateModal(false);
      setShowAddModal(false);
      setMatchingProduct(null);
      resetForm();
      fetchProducts();
    } catch (err) {
      addToast('Failed to insert stock into existing item', 'error');
    } finally {
      setIsInsertingStock(false);
    }
  };

  const handleConsolidateInventory = async () => {
    setIsConsolidating(true);
    try {
      const res = await fetch('/api/products/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBusinessId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.removedDuplicates > 0) {
          addToast(`⚡ Merged ${data.removedDuplicates} duplicate products into unique item codes!`, 'success');
        } else {
          addToast('Inventory clean! No duplicate products found.', 'success');
        }
        fetchProducts();
      } else {
        addToast('Failed to consolidate inventory', 'error');
      }
    } catch (err) {
      addToast('Error consolidating inventory', 'error');
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast(`Product "${product.name}" deleted successfully!`, 'success');
        if (editingProduct?.id === product.id) {
          setShowAddModal(false);
          setEditingProduct(null);
        }
        fetchProducts();
      } else {
        addToast('Failed to delete product', 'error');
      }
    } catch (err) {
      addToast('Error deleting product', 'error');
    }
  };

  const handleTransferState = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/stock/transfer-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          productId: stateTransferProduct.id,
          ...transferData,
        }),
      });

      if (res.ok) {
        addToast(`Condition state updated to ${transferData.toState}!`, 'success');
        setStateTransferProduct(null);
        fetchProducts();
      }
    } catch (err) {
      addToast('Failed to transfer stock condition state', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      model: '',
      partType: 'Display',
      variant: '',
      quality: 'OEM',
      purchasePrice: '',
      sellingPrice: '',
      mrp: '',
      currentStock: '0',
      minStock: '5',
      warranty: '7 Days Testing Warranty',
      categoryId: '',
      locationId: '',
    });
  };

  const handleExportStockExcel = async () => {
    try {
      let url = `/api/products/export/excel?businessId=${activeBusinessId}`;
      if (selectedCategory) {
        url += `&scope=category&categoryId=${selectedCategory}`;
      } else if (activeLocation?.type === 'GODOWN' || (activeLocationId && activeLocationId !== 'ALL')) {
        url += `&scope=godown&locationId=${activeLocationId}`;
      } else {
        url += '&scope=all';
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `BIRD_Stock_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      addToast('Stock inventory exported to Excel!', 'success');
    } catch (err) {
      addToast('Failed to export Excel file', 'error');
    }
  };

  const getStockBadge = (prod) => {
    const stockVal = activeLocationId !== 'ALL' ? (prod.locationStockQuantity ?? prod.currentStock) : prod.currentStock;

    if (stockVal < 0) {
      return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">⚠ Negative ({stockVal})</span>;
    }
    if (stockVal === 0) {
      return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Out of Stock</span>;
    }
    if (stockVal <= prod.minStock) {
      return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Low Stock ({stockVal})</span>;
    }
    return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Good ({stockVal})</span>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-zinc-700" />
            <span>Stock Inventory {activeLocation ? `(${activeLocation.name})` : ''}</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">Physical stock per store & godown distribution.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            title="Scan paper bill or invoice to auto-add stock"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scan Bill (OCR)</span>
          </button>

          <button
            onClick={handleExportStockExcel}
            className="btn-secondary"
            title="Download Stock as Excel"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => navigate('/import')}
            className="btn-secondary"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setEditingProduct(null);
              setShowAddModal(true);
            }}
            className="btn-secondary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Samsung A15, iPhone battery, Folder, OEM, item code..."
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <CustomSelect
            value={selectedQuality}
            onChange={(val) => setSelectedQuality(val)}
            placeholder="All Qualities"
            className="w-36"
            options={[
              { label: 'All Qualities', value: '' },
              { label: 'WD', value: 'WD' },
              { label: 'BIRD', value: 'BIRD' },
            ]}
          />

          <CustomSelect
            value={stockFilter}
            onChange={(val) => setStockFilter(val)}
            placeholder="All Stock"
            className="w-36"
            options={[
              { label: 'All Stock', value: '' },
              { label: 'Low Stock', value: 'LOW' },
              { label: 'Out of Stock', value: 'OUT' },
              { label: 'Good Stock', value: 'GOOD' },
            ]}
          />
        </div>
      </div>

      {/* Category Pills & Category Management */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === ''
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All Parts
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === c.id
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCategoryModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-700 shrink-0 transition-colors"
          title="Manage & Edit Product Categories"
        >
          <Tag className="w-3.5 h-3.5 text-zinc-500" />
          <span className="hidden sm:inline">Manage Categories</span>
        </button>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-xs font-semibold">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Loading inventory...
        </div>
      ) : products.length === 0 ? (
        <div className="bird-card p-10 text-center space-y-3">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No products found</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto font-medium">
            No spare parts match your filter. Click "+ Add Product" to add your first item.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const activeLocStocks = p.locationStocks?.filter(ls => ls.quantity > 0) || [];
            const hasDifferentModel = p.model && p.model.toLowerCase() !== p.name.toLowerCase();

            return (
              <div key={p.id} className="bird-card bird-card-hover p-4 flex flex-col justify-between space-y-3.5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 tracking-tight">{p.name}</h3>
                      {hasDifferentModel && (
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          Model: <span className="text-slate-900 font-semibold">{p.model}</span>
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {p.quality || 'OEM'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-medium">
                    {p.variant && <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 border border-slate-200 font-semibold text-[11px]">{p.variant}</span>}
                    <span>Code: <strong className="text-slate-700">{p.itemCode}</strong></span>
                  </div>

                  {/* SLEEK STOCK DISTRIBUTION SUMMARY */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-semibold">Stock Locations</span>
                      <span className="text-slate-900 font-bold">Total: {p.currentStock} pcs</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {activeLocStocks.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic font-medium">No physical stock in any location</span>
                      ) : (
                        activeLocStocks.map((ls) => (
                          <span
                            key={ls.id}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium flex items-center gap-1.5 shadow-2xs"
                          >
                            <span>{ls.location?.type === 'GODOWN' ? '🏭' : '🏪'}</span>
                            <span>{ls.location?.name}:</span>
                            <strong className="text-slate-900 font-bold">{ls.quantity}</strong>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Price & Status Line */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {p.sellingPrice > 0 ? (
                      <div className="text-sm font-bold text-emerald-700 tabular-nums">₹{Number(p.sellingPrice).toLocaleString('en-IN')}</div>
                    ) : (
                      <div className="text-xs text-slate-400 font-medium italic">Price Not Set</div>
                    )}
                  </div>

                  <div>
                    {getStockBadge(p)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingProduct(p);
                      setFormData({
                        name: p.name,
                        brand: p.brand || '',
                        model: p.model || '',
                        partType: p.partType || 'Display',
                        variant: p.variant || '',
                        quality: p.quality || 'OEM',
                        purchasePrice: p.purchasePrice,
                        sellingPrice: p.sellingPrice,
                        mrp: p.mrp || '',
                        currentStock: String(p.currentStock),
                        minStock: String(p.minStock || 5),
                        warranty: p.warranty || '7 Days Testing Warranty',
                        categoryId: p.categoryId || '',
                        locationId: '',
                      });
                      setShowAddModal(true);
                    }}
                    className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>

                  <button
                    onClick={() => setAdjLocationId(p.id)}
                    className="py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                    title="Stock Adjustment"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setHistoryProduct(p)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Stock Movement Logs"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete Product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingProduct ? 'Edit Mobile Spare Part' : 'Add New Spare Part'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. iPhone 12 Pro Max Display"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, model: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                  />
                </div>
              </div>

              {editingProduct ? (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">📦 Total Stock Quantity</span>
                    <span className="text-slate-500 font-medium"><strong className="text-blue-600 font-extrabold">{editingProduct.currentStock} pcs</strong></span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity (pcs) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-extrabold"
                  />
                </div>
              )}


              <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => setDeletingProduct(editingProduct)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold text-xs transition-colors shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Product</span>
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2.5">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold text-xs text-white transition-all shadow-md shadow-blue-500/20">
                    {editingProduct ? 'Update Product' : 'Save Spare Part'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <span>Manage Product Categories</span>
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create New Category Form */}
            <form onSubmit={handleCreateCategory} className="p-4 border-b border-slate-100 bg-slate-50 flex gap-2.5">
              <input
                type="text"
                required
                placeholder="e.g. Camera Flex, Charging Board, Back Glass..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 font-semibold text-xs text-white rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add Category
              </button>
            </form>

            {/* Existing Categories List */}
            <div className="p-4 overflow-y-auto divide-y divide-slate-100 space-y-2">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">No custom categories created yet.</div>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    {editingCategoryId === cat.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 bg-white border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateCategory(cat.id, editingCategoryName)}
                          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          title="Save Rename"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategoryId(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-700"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{cat.name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{cat._count?.products || 0} spare parts linked</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditingCategoryName(cat.name);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Rename Category"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingCategory(cat)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}


      {/* CONFIRM DELETE PRODUCT MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={confirmDeleteProduct}
        title="Delete Mobile Spare Part"
        message={`Are you sure you want to delete "${deletingProduct?.name}"? This product will be archived from active inventory.`}
        confirmText="Delete Product"
        loading={isDeleting}
      />

      {/* CONFIRM DELETE CATEGORY MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        message={`Are you sure you want to delete category "${deletingCategory?.name}"? Linked products will remain safe.`}
        confirmText="Delete Category"
        loading={isDeleting}
      />

      {/* DUPLICATE PRODUCT APPROVAL MODAL */}
      {showDuplicateModal && matchingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Matching Item Found in Inventory!</h3>
                  <p className="text-xs text-slate-500 font-medium">An item with matching name & quality already exists in your stock catalog.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Matching Card Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">{matchingProduct.name}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                      {matchingProduct.quality || 'OEM'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-semibold mt-0.5">
                    Item Code: <strong className="text-slate-800">{matchingProduct.itemCode || 'N/A'}</strong> {matchingProduct.model ? `• Model: ${matchingProduct.model}` : ''}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Existing Stock</div>
                  <div className="text-base font-extrabold text-blue-600">
                    {matchingProduct.currentStock || 0} pcs
                  </div>
                </div>
              </div>

              {/* Location Breakdown */}
              {matchingProduct.locationStocks && matchingProduct.locationStocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
                  {matchingProduct.locationStocks.map((ls) => (
                    <span key={ls.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {ls.location?.name || 'Godown'}: <strong className="text-blue-600">{ls.quantity} pcs</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 font-medium leading-relaxed">
              💡 <strong>Would you like to insert/add your {formData.currentStock || 1} pcs stock into this existing item ({matchingProduct.name} #{matchingProduct.itemCode}), or create a separate new product entry anyway?</strong>
            </div>

            {/* Approval Decision Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSaveProduct(null, true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all"
              >
                Create New Separate Product
              </button>

              <button
                type="button"
                onClick={handleInsertIntoExisting}
                disabled={isInsertingStock}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isInsertingStock ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Inserting Stock...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Insert Stock into Existing Item (#{matchingProduct.itemCode})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR BILL SCAN STOCK INTAKE MODAL */}
      <CategoryScanStockModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        category="All"
        partType="Spare Part"
        onSuccess={() => {
          fetchProducts();
        }}
      />
    </div>
  );
};

export default StockPage;
