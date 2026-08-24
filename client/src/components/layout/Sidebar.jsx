import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Smartphone,
  BatteryCharging,
  Receipt,
  Users,
  Building2,
  Wallet,
  BarChart3,
  TrendingUp,
  Settings,
  Boxes,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export const Sidebar = () => {
  const navigate = useNavigate();
  const { activeBusiness } = useBusiness();
  const { activeLocation } = useLocation();
  const { isAdmin, user, setAdminModalOpen, lockAdminMode } = useAuth();

  const businessName = activeBusiness?.name || 'MI2 Impex';
  const isGodown = !activeLocation || activeLocation.type === 'GODOWN';

  // Build menu groups based on role and location
  const menuGroups = [
    {
      title: isGodown ? 'GODOWN INVENTORY' : 'STORE OPERATIONS',
      items: isGodown
        ? [
            { name: 'Overview', path: '/', icon: LayoutDashboard },
            { name: 'Folders Stock', path: '/folders', icon: Smartphone },
            { name: 'Batteries Stock', path: '/batteries', icon: BatteryCharging },
            { name: 'All Inventory Stock', path: '/stock', icon: Boxes },
          ]
        : [
            { name: 'Store Dashboard', path: '/', icon: LayoutDashboard },
            { name: 'Folders Hub', path: '/folders', icon: Smartphone },
            { name: 'Batteries Hub', path: '/batteries', icon: BatteryCharging },
            { name: 'Sales & Bills', path: '/sales', icon: Receipt },
            { name: 'Balances & Payouts', path: '/money', icon: Wallet },
            { name: 'Customer Khata Accounts', path: '/customers', icon: Users },
          ],
    },
    {
      title: isGodown ? 'PROCUREMENT' : 'PROCUREMENT & REPORTS',
      items: isGodown
        ? [
            { name: 'Suppliers & Purchases', path: '/suppliers', icon: Building2 },
          ]
        : [
            { name: 'Suppliers & Purchases', path: '/suppliers', icon: Building2 },
            { name: 'Store Reports', path: '/reports', icon: BarChart3 },
          ],
    },
    {
      title: isGodown ? 'SYSTEM & SETTINGS' : (isAdmin ? '👑 ADMIN MANAGEMENT' : 'SETTINGS & ADMIN'),
      items: isGodown
        ? [
            { name: 'Settings', path: '/settings', icon: Settings },
          ]
        : [
            {
              name: 'Profit & Loss (P&L)',
              path: '/pnl',
              icon: TrendingUp,
              badge: isAdmin ? 'ACTIVE' : 'LOCKED',
              badgeColor: isAdmin
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300',
            },
            { name: 'Store Settings', path: '/settings', icon: Settings },
          ],
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 border-r border-slate-200/90 bg-white p-3 shrink-0 min-h-screen justify-between">
      <div className="space-y-4">
        {/* Top-Left Logo Header */}
        <div
          onClick={() => navigate('/')}
          className="pb-3 px-2 border-b border-slate-100 flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[11px] font-black shadow-xs group-hover:bg-slate-800 transition-colors shrink-0">
            MI2
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
              <span>{businessName}</span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">ERP</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">Mobile Spare Parts</div>
          </div>
        </div>

        {/* Navigation Groups */}
        {menuGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
              <span>{group.title}</span>
            </div>
            <nav className="space-y-0.5 pt-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-100 text-slate-950 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-700'}`} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge && (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                              {item.badge}
                            </span>
                          )}
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>}
                        </div>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer System Status & Role Badge */}
      <div className="pt-3 border-t border-slate-100 px-1 space-y-2">
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-emerald-500' : 'bg-amber-500'} shrink-0`}></div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {isAdmin ? '👑 Admin Mode' : '👤 Store Mode'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                {activeLocation ? activeLocation.name : 'Godown'}
              </div>
            </div>
          </div>
          
          {isAdmin ? (
            <button
              type="button"
              onClick={lockAdminMode}
              className="text-[9px] font-bold px-2 py-1 rounded-lg uppercase shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300 transition-colors cursor-pointer"
              title="Lock Admin Mode"
            >
              Lock
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="text-[9px] font-bold px-2 py-1 rounded-lg uppercase shrink-0 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 transition-colors flex items-center gap-0.5 cursor-pointer"
              title="Unlock Admin Mode"
            >
              Unlock
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;


