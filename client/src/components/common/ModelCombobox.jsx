import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Smartphone, BatteryCharging, Box, AlertCircle } from 'lucide-react';

export const ModelCombobox = ({
  products = [],
  value,
  onChange,
  placeholder = '-- Choose Model --',
  categoryType = 'folder', // 'folder' | 'battery' | 'general'
  priceTier = 'RETAIL',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Helper to get tier rate
  const getProductRate = (prod) => {
    if (!prod) return 0;
    if (priceTier === 'REPAIR_SHOP' && prod.repairShopPrice) return prod.repairShopPrice;
    if (priceTier === 'DEALER' && prod.dealerPrice) return prod.dealerPrice;
    if (priceTier === 'WHOLESALE' && prod.wholesalePrice) return prod.wholesalePrice;
    return prod.sellingPrice || 0;
  };

  // Find currently selected product
  const selectedProduct = (products || []).find((p) => p.id === value);

  // Filter products based on search term
  const filteredProducts = (products || []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const modelMatch = (p.model || '').toLowerCase().includes(q);
    const brandMatch = (p.brand || '').toLowerCase().includes(q);
    const qualityMatch = (p.quality || '').toLowerCase().includes(q);
    const codeMatch = (p.itemCode || '').toLowerCase().includes(q);
    const aliasMatch = (p.aliases || '').toLowerCase().includes(q);
    return nameMatch || modelMatch || brandMatch || qualityMatch || codeMatch || aliasMatch;
  });

  // Sort: In-stock items first, then alphabetical
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aStock = a.displayQty !== undefined ? a.displayQty : (a.currentStock || 0);
    const bStock = b.displayQty !== undefined ? b.displayQty : (b.currentStock || 0);
    if (aStock > 0 && bStock <= 0) return -1;
    if (aStock <= 0 && bStock > 0) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < sortedProducts.length - 1 ? prev + 1 : 0;
        scrollIndexIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : sortedProducts.length - 1;
        scrollIndexIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sortedProducts[highlightedIndex]) {
        handleSelect(sortedProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
    }
  };

  const scrollIndexIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-combobox-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelect = (product) => {
    onChange(product.id, product);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearch('');
  };

  // Icon for category
  const CategoryIcon = categoryType === 'battery' ? BatteryCharging : categoryType === 'folder' ? Smartphone : Box;

  // Selected product details
  const selectedRate = selectedProduct ? getProductRate(selectedProduct) : 0;
  const selectedStock = selectedProduct ? (selectedProduct.displayQty !== undefined ? selectedProduct.displayQty : (selectedProduct.currentStock || 0)) : 0;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white hover:bg-slate-50 border rounded-xl px-3 py-2 text-left text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs transition-all focus:outline-none ${
          isOpen
            ? 'ring-2 ring-slate-900/10 border-slate-900'
            : selectedProduct
            ? 'border-slate-300 text-slate-900'
            : 'border-slate-200 text-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CategoryIcon className={`w-4 h-4 shrink-0 ${selectedProduct ? 'text-slate-900' : 'text-slate-400'}`} />
          {selectedProduct ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              <span className="font-bold text-slate-900 truncate">
                {selectedProduct.brand && !selectedProduct.name.toLowerCase().startsWith(selectedProduct.brand.toLowerCase())
                  ? `${selectedProduct.brand} `
                  : ''}
                {selectedProduct.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase shrink-0 border border-slate-200">
                {selectedProduct.quality || 'OEM'}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  selectedStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {selectedStock > 0 ? `${selectedStock} pcs` : '0 pcs'}
              </span>
              {selectedRate > 0 && (
                <span className="font-bold text-slate-900 shrink-0 ml-auto tabular-nums">
                  ₹{Number(selectedRate).toLocaleString('en-IN')}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-medium truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedProduct && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-slate-900' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-950/10 overflow-hidden flex flex-col animate-fade-in min-w-[300px]">
          {/* Live Search Input */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/90 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Search model, brand, quality (e.g. 14 pro, A15, blp)..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-8.5 pr-8 py-1.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1 pt-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              <span>Matching Models ({sortedProducts.length})</span>
              <span>Stock & Rate</span>
            </div>
          </div>

          {/* List of Models */}
          <div
            ref={listRef}
            className="overflow-y-auto max-h-72 py-1 divide-y divide-slate-100"
          >
            {sortedProducts.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                <AlertCircle className="w-5 h-5 mx-auto mb-1.5 text-slate-300" />
                <p className="font-semibold text-slate-600">No matching models found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a different model number</p>
              </div>
            ) : (
              sortedProducts.map((p, idx) => {
                const isSelected = p.id === value;
                const isHighlighted = idx === highlightedIndex;
                const rate = getProductRate(p);
                const stock = p.displayQty !== undefined ? p.displayQty : (p.currentStock || 0);

                return (
                  <div
                    key={p.id}
                    data-combobox-item
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-100 text-slate-950 font-bold'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900">{p.name}</span>
                        {p.brand && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {p.brand}
                          </span>
                        )}
                      </div>
                      {p.model && p.model !== p.name && (
                        <div className="text-[10px] text-slate-500 font-medium truncate">
                          Model: {p.model}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            stock <= 0
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : stock <= 5
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {stock} pcs in Godown
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {p.purchasePrice > 0 && (
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1 rounded">
                              Cost: ₹{Number(p.purchasePrice).toLocaleString('en-IN')}
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-slate-900 tabular-nums">
                            ₹{Number(rate || p.sellingPrice || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

