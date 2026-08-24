import React, { useState, useRef, useEffect } from 'react';
import { User, Phone, Search, X, Check, AlertTriangle, Sparkles, Store } from 'lucide-react';

export const CustomerSelector = ({
  customers = [],
  customerName = '',
  customerPhone = '',
  priceTier = 'RETAIL',
  onCustomerNameChange,
  onCustomerPhoneChange,
  onPriceTierChange,
  onCustomerSelect,
  className = '',
}) => {
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const [matchedPhoneCustomer, setMatchedPhoneCustomer] = useState(null);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);

  const containerRef = useRef(null);

  // Normalize phone helper (digits only, last 10 digits)
  const cleanDigits = (p) => (p || '').replace(/\D/g, '');

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsNameDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter customers by name or phone
  const filteredCustomers = (customers || []).filter((c) => {
    if (!customerName.trim()) return true;
    const q = customerName.toLowerCase().trim();
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const phoneMatch = cleanDigits(c.phone).includes(cleanDigits(q));
    return nameMatch || phoneMatch;
  });

  // Handle customer name change
  const handleNameInput = (value) => {
    onCustomerNameChange(value);
    setIsNameDropdownOpen(true);

    // If user clears or alters name, reset selected customer obj unless exact match
    const exactMatch = (customers || []).find(
      (c) => c.name.toLowerCase().trim() === value.toLowerCase().trim()
    );
    if (exactMatch) {
      applyCustomer(exactMatch);
    } else {
      setSelectedCustomerObj(null);
    }
  };

  // Handle phone input with live reverse lookup
  const handlePhoneInput = (e) => {
    const rawVal = e.target.value;
    // Allow digits only, max 10 digits
    const digitsOnly = cleanDigits(rawVal).slice(0, 10);
    onCustomerPhoneChange(digitsOnly);

    if (digitsOnly.length >= 5) {
      const match = (customers || []).find((c) => {
        const cPhone = cleanDigits(c.phone);
        return cPhone.endsWith(digitsOnly) || digitsOnly.endsWith(cPhone);
      });

      if (match) {
        setMatchedPhoneCustomer(match);
        // If exact 10-digit match and customer name is empty or Walk-in, auto apply
        if (digitsOnly.length === 10 && (!customerName || customerName === 'Walk-in Customer')) {
          applyCustomer(match);
        }
      } else {
        setMatchedPhoneCustomer(null);
      }
    } else {
      setMatchedPhoneCustomer(null);
    }
  };

  // Apply a selected customer
  const applyCustomer = (cust) => {
    onCustomerNameChange(cust.name);
    if (cust.phone) {
      onCustomerPhoneChange(cleanDigits(cust.phone).slice(-10));
    }
    if (cust.priceLevel && onPriceTierChange) {
      onPriceTierChange(cust.priceLevel);
    }
    setSelectedCustomerObj(cust);
    setMatchedPhoneCustomer(null);
    setIsNameDropdownOpen(false);
    if (onCustomerSelect) onCustomerSelect(cust);
  };

  // Quick set to Walk-in
  const handleSetWalkin = () => {
    onCustomerNameChange('Walk-in Customer');
    onCustomerPhoneChange('');
    if (onPriceTierChange) onPriceTierChange('RETAIL');
    setSelectedCustomerObj(null);
    setMatchedPhoneCustomer(null);
    setIsNameDropdownOpen(false);
  };

  // Active dues check
  const activeDue = selectedCustomerObj?.moneyToReceive || 0;

  return (
    <div ref={containerRef} className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>Customer & Mobile Details</span>
        </h3>
        <button
          type="button"
          onClick={handleSetWalkin}
          className="text-[11px] font-semibold text-slate-700 hover:text-slate-950 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Walk-in Customer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Customer Name Input with Search Suggestions */}
        <div className="relative">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Customer Name *
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Mobile / Walk-in"
              value={customerName}
              onChange={(e) => handleNameInput(e.target.value)}
              onFocus={() => setIsNameDropdownOpen(true)}
              className="w-full text-xs font-medium pl-8.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
            {customerName && (
              <button
                type="button"
                onClick={() => {
                  onCustomerNameChange('');
                  setSelectedCustomerObj(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Name Suggestion Dropdown */}
          {isNameDropdownOpen && filteredCustomers.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100 py-1 animate-fade-in">
              {filteredCustomers.slice(0, 15).map((c) => (
                <div
                  key={c.id}
                  onClick={() => applyCustomer(c)}
                  className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{c.name}</div>
                    {c.phone && (
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.priceLevel && c.priceLevel !== 'RETAIL' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                        {c.priceLevel.replace('_', ' ')}
                      </span>
                    )}
                    {c.moneyToReceive > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Due: ₹{Number(c.moneyToReceive).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Number Box */}
        <div className="relative">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Mobile Number (10-Digit)</span>
            {customerPhone && cleanDigits(customerPhone).length === 10 && !selectedCustomerObj && (
              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                <span>New Customer</span>
              </span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold flex items-center gap-1 select-none">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-bold">+91</span>
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="98765 43210"
              value={customerPhone}
              onChange={handlePhoneInput}
              className="w-full text-xs font-bold pl-15 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 tabular-nums tracking-wide"
            />
            {customerPhone && (
              <button
                type="button"
                onClick={() => {
                  onCustomerPhoneChange('');
                  setMatchedPhoneCustomer(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reverse Lookup Hint Pill */}
          {matchedPhoneCustomer && (!selectedCustomerObj || selectedCustomerObj.id !== matchedPhoneCustomer.id) && (
            <div
              onClick={() => applyCustomer(matchedPhoneCustomer)}
              className="mt-1.5 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-800 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate font-medium">
                  Found: <strong>{matchedPhoneCustomer.name}</strong>
                  {matchedPhoneCustomer.moneyToReceive > 0 && ` (Due: ₹${Number(matchedPhoneCustomer.moneyToReceive).toLocaleString('en-IN')})`}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-900 shrink-0 uppercase underline ml-2">
                Apply
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Khata Balance Due Banner (if customer has dues) */}
      {activeDue > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-slate-900">{selectedCustomerObj?.name || customerName}</span> has{' '}
              <strong className="text-amber-700 font-extrabold tabular-nums">
                ₹{Number(activeDue).toLocaleString('en-IN')}
              </strong>{' '}
              unpaid Khata balance.
            </div>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900">
            Khata Due
          </span>
        </div>
      )}
    </div>
  );
};

