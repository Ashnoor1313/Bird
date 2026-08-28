import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import {
  Receipt,
  Plus,
  Search,
  FileText,
  Trash2,
  X,
  User,
  CheckCircle2,
  Printer,
  Share2,
  RefreshCw,
  Download,
  AlertTriangle,
  Store,
  ScanLine,
  Upload,
  Sparkles,
  Camera,
  Boxes,
  Smartphone,
  BatteryCharging,
  Eye,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomerSelector } from '../components/common/CustomerSelector';
import { InvoiceModal } from '../components/modals/InvoiceModal';

import { useSalesData } from '../hooks/useApiQueries';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';
import { TableSkeletonLoader } from '../components/common/SkeletonLoader';

export const SalesPage = () => {
  const { activeBusinessId, activeBusiness } = useBusiness();
  const { locations, activeLocationId, activeLocation } = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [showMakeBillModal, setShowMakeBillModal] = useState(searchParams.get('action') === 'new');
  const [ocrScanningModal, setOcrScanningModal] = useState(false);

  // Selected Invoice Modal (for viewing/printing clean basic invoice)
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Billing Category: 'folders' or 'batteries'
  const [billingCategoryId, setBillingCategoryId] = useState(searchParams.get('category') === 'batteries' ? 'batteries' : 'folders');

  // Billing Location
  const [billingLocationId, setBillingLocationId] = useState('');

  // TanStack Query for Sales list (Instant Cached with SWR)
  const {
    data: sales = [],
    isLoading: loading,
    isFetching,
    refetch: fetchSales,
  } = useSalesData(
    activeBusinessId,
    activeLocationId,
    'ALL',
    debouncedSearch
  );

  // Customer List for search
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPriceTier, setCustomerPriceTier] = useState('RETAIL');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Product List for search
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');

  // Bill Line Items State
  const [billItems, setBillItems] = useState([]);
  const [billDiscount, setBillDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [billNotes, setBillNotes] = useState('');

  // Modal for quick adding new product with stock
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockForm, setAddStockForm] = useState({
    name: '',
    model: '',
    brand: '',
    purchasePrice: '0',
    sellingPrice: '0',
    piecesToAdd: '10',
  });

  const handleOpenAddStockModal = (name = '', existingProd = null, initialPrice = 0) => {
    const resolvedPrice = existingProd
      ? (existingProd.sellingPrice || initialPrice || 0)
      : (initialPrice || 0);

    if (existingProd) {
      setAddStockForm({
        name: existingProd.name || name,
        model: existingProd.model || '',
        brand: existingProd.brand || '',
        purchasePrice: (existingProd.purchasePrice || 0).toString(),
        sellingPrice: (resolvedPrice || 0).toString(),
        piecesToAdd: '10',
      });
    } else {
      setAddStockForm({
        name: name,
        model: '',
        brand: '',
        purchasePrice: '0',
        sellingPrice: (resolvedPrice || 0).toString(),
        piecesToAdd: '10',
      });
    }
    setShowAddStockModal(true);
  };

  const handleSaveQuickStock = async (e) => {
    e.preventDefault();
    if (!addStockForm.name.trim()) return;

    try {
      const targetLoc = billingLocationId || (locations.find(l => l.type === 'STORE')?.id || locations[0]?.id);
      const pieces = parseInt(addStockForm.piecesToAdd || '10', 10);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          locationId: targetLoc,
          categoryId: billingCategoryId,
          partType: billingCategoryId === 'batteries' ? 'Battery' : 'Folder / Display',
          name: addStockForm.name.trim(),
          model: addStockForm.model.trim(),
          brand: addStockForm.brand.trim(),
          purchasePrice: parseFloat(addStockForm.purchasePrice || 0),
          sellingPrice: parseFloat(addStockForm.sellingPrice || 0),
          currentStock: pieces,
        }),
      });

      if (res.ok) {
        const prod = await res.json();
        addToast(`✅ Added ${pieces} pcs to inventory! Available in Godown: ${pieces} pcs.`, 'success');
        setShowAddStockModal(false);
        await fetchProducts();

        // Automatically add to bill items
        addProductToBill(prod);
      } else {
        const errJson = await res.json().catch(() => ({}));
        addToast(errJson.error || 'Failed to add product stock', 'error');
      }
    } catch (err) {
      addToast('Error saving product stock', 'error');
    }
  };

  // Ultra-fast client-side GPU image compressor (resizes 40MP camera photo to ~100KB in ~10ms for instant mobile OCR)
  const compressImageFile = async (imageFile) => {
    if (!imageFile || !imageFile.type.startsWith('image/')) return imageFile;
    try {
      if ('createImageBitmap' in window) {
        const bitmap = await createImageBitmap(imageFile);
        const MAX_DIM = 1400;
        let width = bitmap.width;
        let height = bitmap.height;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        return new Promise((resolve) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], imageFile.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(imageFile);
              }
            },
            'image/jpeg',
            0.82
          );
        });
      }
    } catch (e) {
      console.warn('createImageBitmap fast path fallback:', e);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1400;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], imageFile.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(imageFile);
              }
            },
            'image/jpeg',
            0.82
          );
        };
        img.onerror = () => resolve(imageFile);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(imageFile);
      reader.readAsDataURL(imageFile);
    });
  };

  // Auto-Fill Invoice from Photo / Paper Slip
  const handleScanBillImageForModal = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrScanningModal(true);
    try {
      const optimizedFile = await compressImageFile(file);
      const formData = new FormData();
      formData.append('businessId', activeBusinessId);
      formData.append('categoryId', billingCategoryId);
      formData.append('billFile', optimizedFile);

      const res = await fetch('/api/sales/scan', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.customerName) {
          setCustomerSearch(data.customerName);
          const matchedCust = customers.find(c =>
            c.name.toLowerCase().includes(data.customerName.toLowerCase()) ||
            (data.customerPhone && c.phone && c.phone.includes(data.customerPhone))
          );
          if (matchedCust) {
            setSelectedCustomer(matchedCust);
          }
        }
        if (data.customerPhone && !customerPhone) {
          setCustomerPhone(data.customerPhone);
        }

        if (data.items && data.items.length > 0) {
          const autoFilledItems = data.items.map(item => {
            const matchedProd = item.matchedProduct || (item.matchedProductId
              ? products.find(p => p.id === item.matchedProductId)
              : products.find(p =>
                  p.name?.toLowerCase().trim() === item.productName?.toLowerCase().trim() ||
                  (p.model && p.model.toLowerCase().trim() === item.productName?.toLowerCase().trim()) ||
                  (p.itemCode && p.itemCode.toLowerCase().trim() === item.productName?.toLowerCase().trim())
                ));

            const resolvedUnitPrice = item.unitPrice > 0
              ? item.unitPrice
              : (matchedProd?.sellingPrice || 0);

            return {
              productId: matchedProd?.id || null,
              productName: item.productName || matchedProd?.name || 'Mobile Part',
              model: matchedProd?.model || '',
              quantity: item.quantity || 1,
              unitPrice: resolvedUnitPrice,
              purchasePrice: matchedProd?.purchasePrice || 0,
              gstPercentage: 0,
            };
          });
          setBillItems(autoFilledItems);
          addToast(`✨ Auto-filled ${autoFilledItems.length} items & customer details from document!`, 'success');
        } else {
          addToast('Document scanned, but no clear line items detected. Please ensure image/PDF is readable.', 'info');
        }
      } else {
        addToast('Failed to parse document file', 'error');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      addToast('Error reading document file', 'error');
    } finally {
      setOcrScanningModal(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (activeBusinessId && showMakeBillModal) {
      fetchCustomers();
      fetchProducts();
    }
  }, [activeBusinessId, activeLocationId, billingCategoryId, showMakeBillModal]);

  useEffect(() => {
    if (locations.length > 0 && !billingLocationId) {
      const defaultLoc = activeLocationId !== 'ALL'
        ? activeLocationId
        : (locations.find(l => l.type === 'STORE')?.id || locations[0]?.id || '');
      setBillingLocationId(defaultLoc);
    }
  }, [locations, activeLocationId]);

  const fetchCustomers = async () => {
    try {
      let url = `/api/customers?businessId=${activeBusinessId}&categoryId=${billingCategoryId}`;
      if (activeLocationId && activeLocationId !== 'ALL') {
        url += `&locationId=${activeLocationId}`;
      }
      const res = await fetch(url);
      if (res.ok) setCustomers(await res.json());
    } catch (err) {}
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products?businessId=${activeBusinessId}`);
      if (res.ok) setProducts(await res.json());
    } catch (err) {}
  };

  const addProductToBill = (product) => {
    const existing = billItems.find((i) => i.productId === product.id);
    const unitPrice = product.sellingPrice || 0;
    const purchasePrice = product.purchasePrice || 0;

    if (existing) {
      setBillItems(
        billItems.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setBillItems([
        ...billItems,
        {
          productId: product.id,
          productName: product.name,
          model: product.model,
          quantity: 1,
          unitPrice,
          purchasePrice,
          gstPercentage: 0,
        },
      ]);
    }
    setProductSearch('');
  };

  const removeBillItem = (index) => {
    setBillItems(billItems.filter((_, idx) => idx !== index));
  };

  const calculateSubtotal = () => {
    return billItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateGrandTotal = () => {
    const sub = calculateSubtotal();
    const disc = parseFloat(billDiscount) || 0;
    return Math.max(0, sub - disc);
  };

  const handlePreviewDraftInvoice = () => {
    if (billItems.length === 0) {
      addToast('Please add at least one item to bill to preview', 'error');
      return;
    }
    const grandTotal = calculateGrandTotal();
    const paid = paidAmount === '' ? grandTotal : parseFloat(paidAmount || 0);
    const locObj = locations.find(l => l.id === billingLocationId) || activeLocation;

    const draftInvoice = {
      id: 'draft-preview',
      billNo: 'DRAFT',
      createdAt: new Date().toISOString(),
      customerName: selectedCustomer?.name || customerSearch || 'Walk-in Customer',
      customerPhone: customerPhone || null,
      business: activeBusiness,
      location: locObj,
      items: billItems.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        model: i.model,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        purchasePrice: i.purchasePrice || 0,
      })),
      subtotal: calculateSubtotal(),
      discount: parseFloat(billDiscount || 0),
      total: grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, grandTotal - paid),
      paymentMethod,
      notes: billNotes,
    };

    setSelectedInvoiceForModal(draftInvoice);
    setShowInvoiceModal(true);
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    if (billItems.length === 0) {
      addToast('Please add at least one item to bill', 'error');
      return;
    }

    try {
      const grandTotal = calculateGrandTotal();
      const paid = paidAmount === '' ? grandTotal : parseFloat(paidAmount || 0);

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusinessId,
          locationId: billingLocationId,
          categoryId: billingCategoryId,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || customerSearch || 'Walk-in Customer',
          customerPhone: customerPhone || null,
          items: billItems.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            model: i.model,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            purchasePrice: i.purchasePrice || 0,
            discount: 0,
            gstPercentage: 0,
          })),
          discount: parseFloat(billDiscount || 0),
          paidAmount: paid,
          paymentMethod,
          notes: billNotes,
        }),
      });

      if (res.ok) {
        const sale = await res.json();
        addToast(`✅ Bill #${sale.billNo} generated successfully! Stock adjusted.`, 'success');
        setShowMakeBillModal(false);
        setBillItems([]);
        setCustomerSearch('');
        setCustomerPhone('');
        setSelectedCustomer(null);
        setBillDiscount('0');
        setPaidAmount('');
        setBillNotes('');
        fetchSales();
        fetchProducts();
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['category-hub'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });

        // Immediately open the clean basic invoice for print / WhatsApp share
        setSelectedInvoiceForModal(sale);
        setShowInvoiceModal(true);
      } else {
        const errJson = await res.json().catch(() => ({}));
        addToast(errJson.error || 'Failed to create bill', 'error');
      }
    } catch (err) {
      addToast('Error generating bill', 'error');
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-900">Sales Invoices & Billing</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {activeLocation ? activeLocation.name : 'All Locations'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            Create sales bills, update customer ledgers, and deduct store inventory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMakeBillModal(true)}
            className="btn-primary py-2 px-3 text-xs shadow-xs flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>+ Make Bill</span>
          </button>
        </div>
      </div>

      {/* Search & Sales Table */}
      <div className="bird-card p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bills by bill number, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
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

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading sales records...</span>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Receipt className="w-8 h-8 text-zinc-300 mx-auto" />
            <p className="text-xs font-bold text-zinc-700">No sales bills found</p>
            <button onClick={() => setShowMakeBillModal(true)} className="btn-primary text-xs py-1.5 px-3 font-bold">
              + Make First Bill
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Payment Mode</th>
                  <th>Bill Total</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => {
                      setSelectedInvoiceForModal(sale);
                      setShowInvoiceModal(true);
                    }}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="font-mono font-bold text-xs text-blue-600 hover:underline">#{sale.billNo}</td>
                    <td className="text-zinc-500 text-xs">
                      {new Date(sale.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="font-semibold text-xs text-zinc-900">{sale.customerName}</td>
                    <td>
                      <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 uppercase">
                        {sale.categoryId === 'batteries' ? 'Batteries' : 'Folders'}
                      </span>
                    </td>
                    <td>
                      <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 uppercase">
                        {sale.paymentMethod || 'CASH'}
                      </span>
                    </td>
                    <td className="font-extrabold text-xs text-zinc-900 tabular-nums">
                      ₹{(sale.total || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      {sale.dueAmount > 0 ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Due: ₹{sale.dueAmount}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Paid Full
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedInvoiceForModal(sale);
                            setShowInvoiceModal(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1 transition-colors"
                          title="View / Print Invoice"
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

      {/* ========================================================================= */}
      {/* MAKE BILL MODAL */}
      {/* ========================================================================= */}
      {showMakeBillModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-zinc-200 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Make Sales Bill</h3>
                <p className="text-[11px] text-zinc-500 font-medium">Automatic stock deduction & Customer Khata update</p>
              </div>
              <button onClick={() => setShowMakeBillModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Category Selector Pill */}
              <div className="flex items-center justify-between bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
                <span className="text-xs font-bold text-zinc-600 px-2">Category:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBillingCategoryId('folders')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      billingCategoryId === 'folders'
                        ? 'bg-zinc-900 text-white shadow-2xs'
                        : 'bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Folders</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCategoryId('batteries')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      billingCategoryId === 'batteries'
                        ? 'bg-zinc-900 text-white shadow-2xs'
                        : 'bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Batteries</span>
                  </button>
                </div>
              </div>

              {/* OCR AUTO-FILL BANNER */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3.5 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900 text-xs sm:text-sm">Auto-Fill Bill from Photo / Paper Slip</div>
                    <div className="text-[11px] text-zinc-500 font-medium">Upload a photo of a customer slip or bill to auto-read items, prices & customer name.</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ocrScanningModal ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md">
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Scanning Document...</span>
                    </div>
                  ) : (
                    <>
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer transition-all active:scale-95">
                        <Camera className="w-4 h-4" />
                        <span>Snap Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleScanBillImageForModal}
                          className="hidden"
                          disabled={ocrScanningModal}
                        />
                      </label>

                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95">
                        <Upload className="w-4 h-4 text-zinc-300" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleScanBillImageForModal}
                          className="hidden"
                          disabled={ocrScanningModal}
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Step 1: Customer Selection */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2">
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Customer Details
                  </label>
                  <div className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs text-zinc-500 font-medium">Store Branch:</span>
                    <select
                      value={billingLocationId}
                      onChange={(e) => setBillingLocationId(e.target.value)}
                      className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-800"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.type === 'GODOWN' ? '🏭' : '🏪'} {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <CustomerSelector
                  customers={customers}
                  customerName={selectedCustomer ? selectedCustomer.name : customerSearch}
                  customerPhone={customerPhone}
                  priceTier={customerPriceTier}
                  onCustomerNameChange={(name) => {
                    setSelectedCustomer(null);
                    setCustomerSearch(name);
                  }}
                  onCustomerPhoneChange={setCustomerPhone}
                  onPriceTierChange={setCustomerPriceTier}
                  onCustomerSelect={(cust) => {
                    setSelectedCustomer(cust);
                    setCustomerSearch(cust.name);
                    if (cust.phone) setCustomerPhone(cust.phone.replace(/\D/g, '').slice(-10));
                  }}
                />
              </div>

              {/* Step 2: Line Items & Search */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Product Search & Add to Bill ({billingCategoryId === 'batteries' ? 'Batteries' : 'Folders'})
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={`Search ${billingCategoryId === 'batteries' ? 'battery model (e.g. BN56, BLP-793)' : 'folder model (e.g. A15, 14 pro, Redmi Note 10)'}...`}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />

                  {/* Product Suggestion List */}
                  {productSearch.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-zinc-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto py-1 divide-y divide-zinc-100">
                      <div
                        onClick={() => handleOpenAddStockModal(productSearch)}
                        className="p-2.5 bg-blue-50/60 hover:bg-blue-100/60 cursor-pointer flex items-center justify-between text-xs text-blue-900 font-bold"
                      >
                        <div className="flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                          <span>+ Add New Model: "{productSearch}"</span>
                        </div>
                        <span className="text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 font-extrabold">
                          Add Stock
                        </span>
                      </div>

                      {products
                        .filter((p) => {
                          // 1. Strict Category Isolation
                          const isBattery = p.partType === 'Battery' ||
                            (p.category?.name && p.category.name.toLowerCase().includes('batter')) ||
                            /batter|cell|mah/i.test(p.name);
                          
                          if (billingCategoryId === 'batteries' && !isBattery) return false;
                          if (billingCategoryId === 'folders' && isBattery) return false;

                          // 2. Query Search Matching
                          const q = productSearch.toLowerCase();
                          return (
                            p.name.toLowerCase().includes(q) ||
                            (p.model && p.model.toLowerCase().includes(q)) ||
                            (p.brand && p.brand.toLowerCase().includes(q))
                          );
                        })
                        .map((p) => {
                          const stockQty = p.currentStock ?? p.locationStockQuantity ?? 0;

                          return (
                            <div
                              key={p.id}
                              className="p-2.5 hover:bg-zinc-50 flex items-center justify-between text-xs gap-3"
                            >
                              <div onClick={() => addProductToBill(p)} className="cursor-pointer flex-1 min-w-0">
                                <div className="font-bold text-zinc-900">{p.name}</div>
                                <div className="text-[10px] text-zinc-400 font-medium">
                                  {p.brand && <span className="font-bold text-zinc-600">{p.brand} • </span>}
                                  Model: {p.model || p.name}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    {p.purchasePrice > 0 && (
                                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                        Cost: ₹{p.purchasePrice}
                                      </span>
                                    )}
                                    <span className="font-extrabold text-xs text-zinc-900 tabular-nums">
                                      ₹{p.sellingPrice || 0}
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-bold mt-0.5">
                                    <span className={stockQty <= 0 ? 'text-rose-600' : stockQty <= 5 ? 'text-amber-600' : 'text-emerald-700'}>
                                      {stockQty} in Stock
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => addProductToBill(p)}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-black text-white font-bold text-xs shadow-xs"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Items Container */}
                <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
                  <div className="p-2.5 bg-zinc-100/80 border-b border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500 font-bold">
                    <span>BILL LINE ITEMS ({billItems.length})</span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      💡 Click on any item name, qty, or rate to edit directly
                    </span>
                  </div>

                  {/* MOBILE VIEW (< sm): Responsive Touch Card List */}
                  <div className="block sm:hidden divide-y divide-zinc-200/80 bg-white">
                    {billItems.length === 0 ? (
                      <div className="p-6 text-center text-zinc-400 text-xs font-medium">
                        No items added to bill yet. Search models above or upload photo.
                      </div>
                    ) : (
                      billItems.map((item, idx) => {
                        const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);
                        return (
                          <div key={idx} className="p-3 space-y-2.5 bg-white hover:bg-zinc-50/50">
                            {/* Top Row: Item Name, Line Total & Delete */}
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={item.productName}
                                onChange={(e) => {
                                  const updated = [...billItems];
                                  updated[idx].productName = e.target.value;
                                  setBillItems(updated);
                                }}
                                className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200 focus:border-zinc-900 rounded-lg px-2.5 py-1.5 font-bold text-xs text-zinc-900 focus:outline-none"
                                placeholder="Edit item name..."
                              />
                              <div className="text-right shrink-0">
                                <span className="font-extrabold text-sm text-emerald-600 tabular-nums">
                                  ₹{lineTotal.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeBillItem(idx)}
                                className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Bottom Row: Quantity Stepper & Selling Rate Input */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              {/* Quantity Stepper */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-extrabold text-zinc-500 uppercase">Qty:</span>
                                <div className="inline-flex items-center border border-zinc-200 rounded-lg bg-zinc-50 overflow-hidden shadow-2xs min-w-[100px] justify-between">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.quantity > 1) {
                                        const updated = [...billItems];
                                        updated[idx].quantity -= 1;
                                        setBillItems(updated);
                                      } else {
                                        removeBillItem(idx);
                                      }
                                    }}
                                    className="px-2.5 py-1 hover:bg-zinc-200 text-zinc-700 font-bold text-xs"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10) || 1;
                                      const updated = [...billItems];
                                      updated[idx].quantity = Math.max(1, val);
                                      setBillItems(updated);
                                    }}
                                    className="w-14 min-w-[48px] text-center text-xs font-black text-zinc-900 bg-white focus:outline-none py-1 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...billItems];
                                      updated[idx].quantity += 1;
                                      setBillItems(updated);
                                    }}
                                    className="px-2.5 py-1 hover:bg-zinc-200 text-zinc-700 font-bold text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Selling Rate Input */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-extrabold text-zinc-500 uppercase">Rate:</span>
                                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 focus-within:border-zinc-900 focus-within:bg-white shadow-2xs">
                                  <span className="text-zinc-400 text-xs mr-0.5">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.unitPrice}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const updated = [...billItems];
                                      updated[idx].unitPrice = val;
                                      setBillItems(updated);
                                    }}
                                    className="w-16 text-right font-extrabold text-xs text-zinc-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* DESKTOP VIEW (>= sm): Full Table */}
                  <table className="hidden sm:table w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-bold uppercase text-[10px]">
                        <th className="p-2.5">Item / Model (Editable)</th>
                        <th className="p-2.5 text-center w-24">Cost</th>
                        <th className="p-2.5 text-center w-36">Quantity</th>
                        <th className="p-2.5 text-right w-28">Selling Rate</th>
                        <th className="p-2.5 text-right w-28">Total</th>
                        <th className="p-2.5 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/60 bg-white">
                      {billItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-400 text-xs font-medium">
                            No items added to bill yet. Search models above or upload photo.
                          </td>
                        </tr>
                      ) : (
                        billItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/50">
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.productName}
                                onChange={(e) => {
                                  const updated = [...billItems];
                                  updated[idx].productName = e.target.value;
                                  setBillItems(updated);
                                }}
                                className="w-full bg-white border border-zinc-200 focus:border-zinc-900 rounded-lg px-2.5 py-1 font-bold text-xs text-zinc-900 focus:outline-none shadow-2xs"
                                placeholder="Edit item / model name..."
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center">
                                <span className="text-zinc-400 text-[10px] mr-0.5">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.purchasePrice || 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updated = [...billItems];
                                    updated[idx].purchasePrice = val;
                                    setBillItems(updated);
                                  }}
                                  className="w-16 text-center bg-white border border-zinc-200 rounded-lg px-1.5 py-1 text-xs font-semibold text-zinc-600 focus:outline-none focus:border-zinc-900 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="inline-flex items-center border border-zinc-200 rounded-lg bg-white overflow-hidden shadow-2xs min-w-[104px] justify-between">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.quantity > 1) {
                                      const updated = [...billItems];
                                      updated[idx].quantity -= 1;
                                      setBillItems(updated);
                                    } else {
                                      removeBillItem(idx);
                                    }
                                  }}
                                  className="px-2.5 py-1 hover:bg-zinc-100 text-zinc-600 font-bold"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    const updated = [...billItems];
                                    updated[idx].quantity = Math.max(1, val);
                                    setBillItems(updated);
                                  }}
                                  className="w-16 min-w-[56px] text-center text-xs font-black text-zinc-900 focus:outline-none py-1 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...billItems];
                                    updated[idx].quantity += 1;
                                    setBillItems(updated);
                                  }}
                                  className="px-2.5 py-1 hover:bg-zinc-100 text-zinc-600 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-right">
                              <div className="flex items-center justify-end">
                                <span className="text-zinc-400 text-[10px] mr-0.5">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updated = [...billItems];
                                    updated[idx].unitPrice = val;
                                    setBillItems(updated);
                                  }}
                                  className="w-20 text-right bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-extrabold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-2xs"
                                />
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-extrabold text-xs text-zinc-900 tabular-nums">
                              ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeBillItem(idx)}
                                className="p-1 text-zinc-400 hover:text-rose-600 rounded-md"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 3: Payment & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['CASH', 'UPI', 'BANK'].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMethod(mode)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            paymentMethod === mode
                              ? 'bg-zinc-900 text-white shadow-2xs'
                              : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid Now (₹)</label>
                    <input
                      type="number"
                      placeholder={`e.g. ₹${Number(calculateGrandTotal() || 0).toLocaleString('en-IN')}`}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setPaidAmount((calculateGrandTotal() || 0).toString())}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer transition-colors"
                      >
                        Paid in Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount('0')}
                        className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 cursor-pointer transition-colors"
                      >
                        Full Credit (Khata)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs flex flex-col justify-between">
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-zinc-200">
                    <div className="flex justify-between text-zinc-500 font-medium">
                      <span>Subtotal:</span>
                      <span className="font-bold text-zinc-900">₹{calculateSubtotal().toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-500 font-medium">
                      <span>Discount (₹):</span>
                      <input
                        type="number"
                        min="0"
                        value={billDiscount}
                        onChange={(e) => setBillDiscount(e.target.value)}
                        className="w-16 text-right bg-zinc-50 border border-zinc-200 rounded px-1.5 py-0.5 text-xs font-bold text-rose-600"
                      />
                    </div>
                    <div className="border-t border-zinc-100 pt-1 flex justify-between text-sm font-black text-zinc-900">
                      <span>Grand Total:</span>
                      <span className="text-blue-700">₹{calculateGrandTotal().toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMakeBillModal(false)}
                      className="btn-secondary py-2 px-3 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePreviewDraftInvoice}
                      className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs flex items-center gap-1.5 transition-colors border border-zinc-300"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Invoice</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateBill}
                      className="btn-primary py-2 px-4 text-xs font-black shadow-md flex items-center gap-1.5"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Create & Print Invoice</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BASIC INVOICE MODAL */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        sale={selectedInvoiceForModal}
        business={activeBusiness}
      />

      {/* QUICK ADD MODEL MODAL */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-sm text-zinc-900">+ Add Model & Stock</h3>
              <button onClick={() => setShowAddStockModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductAndAddStock} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  required
                  value={addStockForm.name}
                  onChange={(e) => setAddStockForm({ ...addStockForm, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Apple, Xiaomi"
                  value={addStockForm.brand}
                  onChange={(e) => setAddStockForm({ ...addStockForm, brand: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    value={addStockForm.purchasePrice}
                    onChange={(e) => setAddStockForm({ ...addStockForm, purchasePrice: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Selling Rate (₹)</label>
                  <input
                    type="number"
                    value={addStockForm.sellingPrice}
                    onChange={(e) => setAddStockForm({ ...addStockForm, sellingPrice: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Pieces to Add *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={addStockForm.piecesToAdd}
                  onChange={(e) => setAddStockForm({ ...addStockForm, piecesToAdd: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={() => setShowAddStockModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary font-bold">
                  Save & Add to Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;
