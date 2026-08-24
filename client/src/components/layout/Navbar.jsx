import React, { useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { ChevronDown, Search, Plus, Store, Check, Sparkles, Building2, MapPin } from 'lucide-react';
import { useNavigate, useLocation as useRouteLocation } from 'react-router-dom';

export const Navbar = ({ onOpenSearch, onOpenQuickAction }) => {
  const { activeBusiness, selectBusiness } = useBusiness();
  const { locations, activeLocationId, activeLocation, selectLocation } = useLocation();
  const { businesses, user, isAdmin, setAdminModalOpen, lockAdminMode } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigate = useNavigate();
  const routeLocation = useRouteLocation();

  const getLocationIcon = (type) => {
    switch (type) {
      case 'GODOWN':
        return '🏭';
      case 'STORE':
        return '🏪';
      case 'WAREHOUSE':
        return '🏢';
      default:
        return '🌐';
    }
  };

  // Generate breadcrumb title
  const getPageTitle = () => {
    switch (routeLocation.pathname) {
      case '/':
        return 'Dashboard Overview';
      case '/folders':
      case '/stock/folders':
        return 'Folders Stock';
      case '/batteries':
      case '/stock/batteries':
        return 'Batteries Stock';
      case '/stock':
        return 'Central Stock Inventory';
      case '/sales':
        return 'Sales Bills & Invoices';
      case '/purchases':
        return 'Supplier Purchases';
      case '/customers':
        return 'Customer Directory & Khata';
      case '/suppliers':
        return 'Supplier Accounts';
      case '/money':
        return 'Money & Transactions';
      case '/reports':
        return 'Business Analytics & Reports';
      case '/scan-bill':
        return 'Scan Paper Bill (OCR)';
      case '/import':
        return 'Bulk Import & Export';
      case '/settings':
        return 'Store & System Settings';
      default:
        return 'Mobile Spare Parts OS';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Side: Breadcrumb & Context Chips */}
        <div className="flex items-center gap-2.5">
          {/* Mobile Logo for small screens */}
          <div className="flex items-center gap-2 cursor-pointer lg:hidden" onClick={() => navigate('/')}>
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
              MI2
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">{activeBusiness?.name || 'MI2 Impex'}</span>
          </div>

          <div className="hidden lg:flex flex-col">
            <h2 className="text-xs font-bold text-slate-900 tracking-tight leading-none">{getPageTitle()}</h2>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mt-0.5">
              <span>{activeBusiness?.name || 'My Business'}</span>
              <span>•</span>
              <span className="text-slate-700 font-semibold">{activeLocation ? activeLocation.name : 'All Locations'}</span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block mx-1"></div>

          {/* Business Selector Pill (Desktop / Tablet) */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setLocationDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span className="max-w-[110px] sm:max-w-[140px] truncate">
                {activeBusiness ? activeBusiness.name : 'Select Business'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-950/10 z-50 py-1.5 animate-fade-in">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Active Business
                </div>
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      selectBusiness(b);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeBusiness?.id === b.id ? 'bg-slate-100 text-slate-950 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span>{b.name}</span>
                    {activeBusiness?.id === b.id && <Check className="w-3.5 h-3.5 text-slate-900" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location Selector Pill (Visible on both Mobile & Desktop) */}
          <div className="relative">
            <button
              onClick={() => {
                setLocationDropdownOpen(!locationDropdownOpen);
                setDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="text-xs">
                {activeLocation ? getLocationIcon(activeLocation.type) : '🌐'}
              </span>
              <span className="max-w-[110px] sm:max-w-[140px] truncate font-bold text-slate-900">
                {activeLocation ? activeLocation.name : 'All Locations'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {locationDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-950/10 z-50 py-1.5 animate-fade-in">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Location Context
                </div>

                <button
                  onClick={() => {
                    selectLocation('ALL');
                    setLocationDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    activeLocationId === 'ALL' ? 'bg-slate-100 text-slate-950 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>🌐</span>
                    <span>All Locations (Business-wide)</span>
                  </div>
                  {activeLocationId === 'ALL' && <Check className="w-3.5 h-3.5 text-slate-900" />}
                </button>

                <div className="my-1 border-t border-slate-100"></div>

                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      selectLocation(loc.id);
                      setLocationDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeLocationId === loc.id ? 'bg-slate-100 text-slate-950 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{getLocationIcon(loc.type)}</span>
                      <span>{loc.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">({loc.type})</span>
                    </div>
                    {activeLocationId === loc.id && <Check className="w-3.5 h-3.5 text-slate-900" />}
                  </button>
                ))}

                <div className="my-1 border-t border-slate-100"></div>

                <button
                  onClick={() => {
                    setLocationDropdownOpen(false);
                    navigate('/settings?tab=locations');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Manage Locations</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Global Search, Role Switcher & Quick Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Search parts, bills, customers...</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.2 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500 shadow-2xs">
              Ctrl+K
            </kbd>
          </button>

          {/* User Mode & Admin Unlock Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setDropdownOpen(false);
                setLocationDropdownOpen(false);
                setUserMenuOpen(!userMenuOpen);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                isAdmin
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span>{isAdmin ? '👑' : '👤'}</span>
              <span className="hidden sm:inline">
                {isAdmin ? 'Admin Mode' : 'Store Mode'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-950/10 z-50 p-2 animate-fade-in space-y-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Mode</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                      isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {isAdmin ? 'ADMIN (ACTIVE)' : 'STORE POS'}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-1 truncate">
                    {isAdmin ? '👑 Master Admin Mode' : '👤 Standard Store Counter'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    {isAdmin ? 'Full P&L, Settings & Stores' : 'Billing, Inventory & Khata'}
                  </div>
                </div>

                <div className="space-y-1">
                  {!isAdmin ? (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setAdminModalOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">👑</span>
                        <div>
                          <div className="font-bold text-amber-900">Activate Admin Mode</div>
                          <div className="text-[10px] text-amber-700/80 font-normal">Enter admin password for P&L</div>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        lockAdminMode();
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔒</span>
                        <div>
                          <div className="font-bold">Lock Admin Mode</div>
                          <div className="text-[10px] text-slate-500 font-normal">Switch back to Store Counter</div>
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left p-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>⚙️</span>
                    <span>Store Settings</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/login');
                    }}
                    className="w-full text-left p-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>🚪</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onOpenQuickAction}
            className="btn-primary hidden md:inline-flex"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-300" />
            <span>Quick Action</span>
          </button>
        </div>
      </div>
    </header>
  );
};


