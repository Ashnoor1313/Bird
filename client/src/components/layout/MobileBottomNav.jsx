import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Smartphone,
  BatteryCharging,
  Receipt,
  Wallet,
  Settings,
  TrendingUp,
  Plus,
} from 'lucide-react';

export const MobileBottomNav = ({ onOpenQuickAction, onOpenMore }) => {
  const { activeLocation } = useLocation();
  const { isAdmin } = useAuth();

  const isGodown = !activeLocation || activeLocation.type === 'GODOWN';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3 py-1.5 flex items-center justify-around safe-bottom shadow-lg shadow-slate-900/5">
      {/* 1. Home Tab */}
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl text-[10px] font-semibold transition-colors ${
            isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`
        }
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Home</span>
      </NavLink>

      {/* 2. Folders Tab */}
      <NavLink
        to="/folders"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl text-[10px] font-semibold transition-colors ${
            isActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`
        }
      >
        <Smartphone className="w-4 h-4" />
        <span>Folders</span>
      </NavLink>

      {/* 3. Integrated Center Quick Action Button (+) */}
      <div className="flex-1 flex items-center justify-center -mt-4">
        <button
          onClick={onOpenQuickAction}
          className="w-11 h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-lg shadow-slate-950/25 active:scale-95 transition-transform border-2 border-white cursor-pointer"
          aria-label="Quick Action Menu"
          title="Quick Actions"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 4. Batteries Tab */}
      <NavLink
        to="/batteries"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl text-[10px] font-semibold transition-colors ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`
        }
      >
        <BatteryCharging className="w-4 h-4" />
        <span>Batteries</span>
      </NavLink>

      {/* 5. Billing / Money Tab */}
      <NavLink
        to={isGodown ? "/money" : "/sales"}
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl text-[10px] font-semibold transition-colors ${
            isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`
        }
      >
        {isGodown ? <Wallet className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
        <span>{isGodown ? 'Money' : 'Billing'}</span>
      </NavLink>
    </nav>
  );
};

export default MobileBottomNav;

