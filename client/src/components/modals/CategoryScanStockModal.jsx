import React, { useState } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Boxes,
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';
import { useQueryClient } from '@tanstack/react-query';

export const CategoryScanStockModal = ({
  isOpen,
  onClose,
  category = 'Folders', // 'Folders' | 'Batteries' | 'All'
  partType = 'Folder / Display',
  onSuccess,
}) => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId, activeLocation, locations } = useLocation();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState('upload'); // 'upload' | 'review' | 'saving'

  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState([]);
  const [confidence, setConfidence] = useState(90);

  if (!isOpen) return null;

  const targetLocation = activeLocationId && activeLocationId !== 'ALL'
    ? activeLocation
    : locations?.find((l) => l.type === 'GODOWN') || locations?.[0];

  const targetLocationId = targetLocation?.id;
  const targetLocationName = targetLocation?.name || 'Godown';

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleRunOcr = async () => {
    if (!file) {
      addToast('Please upload or snap a photo of the bill first', 'error');
      return;
    }

    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('businessId', activeBusinessId);
      formData.append('locationId', targetLocationId || '');
      formData.append('billFile', file);

      const res = await fetch('/api/purchases/scan', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setSupplierName(data.supplier?.matchedSupplierName || data.supplier?.extractedName || 'Wholesale Supplier');
        setInvoiceNumber(data.invoiceNumber || `BILL-${Math.floor(1000 + Math.random() * 9000)}`);
        setConfidence(data.confidence?.overall || 88);

        // Pre-process items for this category
        const rawItems = (data.items || []).map((item) => {
          const isExisting = Boolean(item.matchedProductId);
          return {
            productName: item.productName || 'Spare Part Item',
            model: item.matchedProduct?.model || item.productName || '',
            quality: item.matchedProduct?.quality || 'OEM',
            quantity: parseInt(item.quantity, 10) || 1,
            unitPrice: parseFloat(item.unitPrice || 0),
            matchedProductId: item.matchedProductId || null,
            matchedProduct: item.matchedProduct || null,
            isExisting,
          };
        });

        if (rawItems.length === 0) {
          rawItems.push({
            productName: `${category === 'Batteries' ? 'Battery' : 'Folder'} Item 1`,
            model: '',
            quality: 'OEM',
            quantity: 10,
            unitPrice: 0,
            matchedProductId: null,
            matchedProduct: null,
            isExisting: false,
          });
        }

        setItems(rawItems);
        setStep('review');
        addToast(`OCR Extracted ${rawItems.length} line items successfully!`, 'success');
      } else {
        addToast('Failed to parse bill. Please ensure the image is clear and well lit.', 'error');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      addToast('Error during document OCR processing', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productName: `New ${category === 'Batteries' ? 'Battery' : 'Folder'} Model`,
        model: '',
        quality: 'OEM',
        quantity: 10,
        unitPrice: 0,
        matchedProductId: null,
        matchedProduct: null,
        isExisting: false,
      },
    ]);
  };

  const handleConfirmStockIntake = async () => {
    if (items.length === 0) {
      addToast('No items to inward into stock', 'error');
      return;
    }

    setStep('saving');
    try {
      // Find category ID for Folders / Batteries if available
      let resolvedCategoryId = undefined;
      const catRes = await fetch(`/api/products/categories?businessId=${activeBusinessId}`);
      if (catRes.ok) {
        const categories = await catRes.json();
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === category.toLowerCase() ||
                 (category === 'Folders' && c.name.toLowerCase().includes('folder')) ||
                 (category === 'Batteries' && c.name.toLowerCase().includes('batter'))
        );
        if (matchedCat) resolvedCategoryId = matchedCat.id;
      }

      let updatedCount = 0;
      let createdCount = 0;
      let totalPieces = 0;

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) continue;
        totalPieces += qty;

        const purchasePrice = parseFloat(item.unitPrice) || 0;
        const defaultSellingPrice = purchasePrice > 0 ? Math.round(purchasePrice * 1.3) : 0;

        if (item.matchedProductId) {
          // 1. UPDATE EXISTING PRODUCT STOCK
          await fetch('/api/stock/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: activeBusinessId,
              productId: item.matchedProductId,
              locationId: targetLocationId,
              quantity: qty,
              type: 'PURCHASE',
              reference: invoiceNumber || 'OCR-INTAKE',
              note: `OCR Intake (${supplierName}) - Added ${qty} pcs`,
            }),
          });
          updatedCount++;
        } else {
          // 2. CREATE NEW PRODUCT & INITIALIZE STOCK
          const createRes = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: activeBusinessId,
              categoryId: resolvedCategoryId,
              name: item.productName.trim(),
              model: (item.model || item.productName).trim(),
              brand: 'Universal',
              quality: item.quality || 'OEM',
              partType: partType || (category === 'Batteries' ? 'Battery' : 'Folder / Display'),
              purchasePrice,
              sellingPrice: defaultSellingPrice,
              currentStock: qty,
              minStock: 5,
              locationId: targetLocationId,
            }),
          });

          if (createRes.ok) {
            createdCount++;
          }
        }
      }

      // Invalidate queries to refresh UI immediately
      queryClient.invalidateQueries({ queryKey: ['category-hub'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      addToast(
        `Intake Complete! Added ${totalPieces} pcs (${updatedCount} updated, ${createdCount} created) to ${targetLocationName}.`,
        'success'
      );

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error during stock intake:', err);
      addToast('Failed to complete stock intake', 'error');
      setStep('review');
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl(null);
    setScanning(false);
    setStep('upload');
    setItems([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white border-t sm:border border-slate-200 w-full max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Camera className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                  Scan & Add {category} Stock
                </h3>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  AI OCR
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate mt-0.5">
                Receiving into: <strong className="text-slate-800 font-bold">{targetLocationName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3.5">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <label
                htmlFor="ocr-bill-input"
                className="border-2 border-dashed border-slate-300 hover:border-slate-800 bg-slate-50/60 hover:bg-slate-50 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-3 group"
              >
                <input
                  id="ocr-bill-input"
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform text-slate-800">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Bill Preview" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-500" />
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {file ? file.name : 'Take photo or upload supplier bill'}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1 max-w-md">
                    Supports mobile camera capture, paper invoices, wholesale receipts & WhatsApp bill screenshots
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="btn-secondary py-1.5 px-3 text-xs pointer-events-none">
                    Browse File
                  </span>
                  <span className="text-xs text-slate-400">or tap to photograph</span>
                </div>
              </label>

              {file && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                    className="btn-secondary py-2 px-3 text-xs font-bold"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleRunOcr}
                    disabled={scanning}
                    className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2"
                  >
                    {scanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Running AI OCR...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Extract & Match Line Items</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              {/* Supplier & Bill Info Card */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Supplier Name</span>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="e.g. Wholesale Supplier"
                      className="w-full font-bold text-xs text-slate-900 bg-transparent outline-none pt-0.5"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Bill / Invoice #</span>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-1029"
                      className="w-full font-bold text-xs text-slate-900 bg-transparent outline-none pt-0.5"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    ✓ {confidence}% OCR Confidence
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn-secondary py-1 px-2.5 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* Items List (Mobile Adaptive Cards + Desktop Table) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                  <span>Extracted Line Items ({items.length})</span>
                  <span>Total Pcs: {items.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0)}</span>
                </div>

                {/* Mobile Cards (visible on < sm) */}
                <div className="block sm:hidden space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Item Model / Title</label>
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleUpdateItem(idx, 'productName', e.target.value)}
                            placeholder="Enter item model name"
                            className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5 focus:border-slate-900 focus:bg-white outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-slate-300 hover:text-rose-600 transition-colors mt-3"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Quantity (Pcs)</span>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="w-full text-xs font-black text-slate-900 bg-transparent outline-none mt-0.5"
                          />
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Buy Rate (₹)</span>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                            className="w-full text-xs font-black text-slate-900 bg-transparent outline-none mt-0.5"
                          />
                        </div>
                      </div>

                      <div className="pt-1">
                        {item.matchedProductId ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md w-full justify-center">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">Updates #{item.matchedProduct?.itemCode || 'Existing Stock'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md w-full justify-center">
                            <Plus className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Auto-Creates New Catalog Item</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (visible on sm and up) */}
                <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Item / Model Name</th>
                        <th className="py-2.5 px-2 text-center w-24">Qty (Pcs)</th>
                        <th className="py-2.5 px-2 text-right w-28">Buy Rate (₹)</th>
                        <th className="py-2.5 px-3 w-48">Intake Action</th>
                        <th className="py-2.5 px-2 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => handleUpdateItem(idx, 'productName', e.target.value)}
                              className="w-full text-xs font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 outline-none py-1"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                              className="w-16 text-center text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg py-1 focus:ring-1 focus:ring-slate-900"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                              className="w-20 text-right text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg py-1 focus:ring-1 focus:ring-slate-900"
                            />
                          </td>
                          <td className="py-2 px-3">
                            {item.matchedProductId ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">Updates #{item.matchedProduct?.itemCode || 'Stock'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                <Plus className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Creates New Item</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Remove line item"
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

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="btn-secondary py-2 px-3 text-xs font-bold order-2 sm:order-1"
                >
                  Back to Upload
                </button>

                <div className="flex items-center justify-between sm:justify-end gap-3 order-1 sm:order-2">
                  <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                    Total:{' '}
                    <strong className="text-slate-900 font-bold">
                      {items.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0)} pcs
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleConfirmStockIntake}
                    className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-initial"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Inward to {targetLocationName}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="py-16 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-slate-900 animate-spin mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-slate-900">Inwarding Stock & Updating Catalog...</h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Updating physical stock quantities for {targetLocationName}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryScanStockModal;
