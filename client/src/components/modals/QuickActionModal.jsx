import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Smartphone,
  BatteryCharging,
  Camera,
  FileSpreadsheet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { useLocation } from '../../context/LocationContext';

export const QuickActionModal = ({ isOpen, onClose, onActionSelect }) => {
  const navigate = useNavigate();
  const { activeLocation } = useLocation();

  if (!isOpen) return null;

  const isGodown = !activeLocation || activeLocation.type === 'GODOWN';

  const actions = isGodown
    ? [
        { id: 'folders', label: 'Folders Stock', desc: 'Add or adjust folder models', icon: Smartphone, path: '/folders' },
        { id: 'batteries', label: 'Batteries Stock', desc: 'Add or adjust battery models', icon: BatteryCharging, path: '/batteries' },
        { id: 'scan-bill', label: 'Photo / Bill OCR', desc: 'Snap photo of bill or handwritten slip', icon: Camera, path: '/scan-bill' },
        { id: 'import-excel', label: 'Import Excel', desc: 'Upload stock spreadsheet (.xlsx, .csv)', icon: FileSpreadsheet, path: '/import' },
      ]
    : [
        { id: 'make-bill', label: 'Create Sale Bill', desc: 'Fast mobile customer sale', icon: Receipt, path: '/sales?action=new' },
        { id: 'receive-money', label: 'Receive Money', desc: 'Record payment from customer', icon: ArrowDownLeft, path: '/money?action=receive' },
        { id: 'pay-money', label: 'Pay Money', desc: 'Pay supplier or log expense', icon: ArrowUpRight, path: '/money?action=pay' },
        { id: 'folders', label: 'Store Folders', desc: 'View store folder stock', icon: Smartphone, path: '/folders' },
        { id: 'batteries', label: 'Store Batteries', desc: 'View store battery stock', icon: BatteryCharging, path: '/batteries' },
      ];

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white border border-zinc-200 w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Quick Actions</h3>
            <p className="text-xs text-zinc-500 font-medium">Select an action to proceed</p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[70vh] overflow-y-auto">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => {
                  onClose();
                  if (onActionSelect) onActionSelect(act.id);
                  else navigate(act.path);
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 hover:border-zinc-300 text-left transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-zinc-900 group-hover:text-zinc-950 transition-colors">{act.label}</div>
                  <div className="text-[11px] text-zinc-500 line-clamp-1 font-medium">{act.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
