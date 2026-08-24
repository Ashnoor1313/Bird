import React, { useState, useEffect } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Settings,
  Save,
  Database,
  Building2,
  MapPin,
  Plus,
  Store,
  Warehouse,
  Edit2,
  Trash2,
  Check,
  X,
  Tags,
  AlertTriangle,
  RefreshCw,
  Users,
  ShieldCheck,
  Lock,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const SettingsPage = () => {
  const { activeBusiness, activeBusinessId, triggerRefresh } = useBusiness();
  const { locations, refreshLocations } = useLocation();
  const { isAdmin, unlockAdminMode, lockAdminMode } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'business'
  ); // 'business' | 'categories' | 'locations' | 'staff' | 'security'

  // Admin Mode Inline Unlock State
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // Change Admin Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentAdminPass, setCurrentAdminPass] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [changePassLoading, setChangePassLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: activeBusiness?.name || '',
    phone: activeBusiness?.phone || '',
    email: activeBusiness?.email || '',
    address: activeBusiness?.address || '',
    gstin: activeBusiness?.gstin || '',
    billPrefix: activeBusiness?.billPrefix || 'BIRD',
    allowNegativeStock: activeBusiness?.allowNegativeStock || false,
    terms: activeBusiness?.terms || '',
  });

  // Categories State
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Location modal / edit form
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    type: 'STORE',
    address: '',
    phone: '',
    managerName: '',
  });

  // Staff / User Management State (Admin Only)
  const [staffUsers, setStaffUsers] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
  });

  useEffect(() => {
    if (activeBusiness) {
      setFormData({
        name: activeBusiness.name || '',
        phone: activeBusiness.phone || '',
        email: activeBusiness.email || '',
        address: activeBusiness.address || '',
        gstin: activeBusiness.gstin || '',
        billPrefix: activeBusiness.billPrefix || 'BIRD',
        allowNegativeStock: Boolean(activeBusiness.allowNegativeStock),
        terms: activeBusiness.terms || '',
      });
    }
  }, [activeBusiness]);

  useEffect(() => {
    if (activeBusinessId) {
      fetchCategories();
      if (isAdmin) fetchStaffUsers();
    }
  }, [activeBusinessId, isAdmin]);

  const handleActivateAdminMode = async (e) => {
    if (e) e.preventDefault();
    if (!adminPasswordInput) {
      setUnlockError('Please enter admin password');
      return;
    }

    setUnlockLoading(true);
    setUnlockError('');

    try {
      await unlockAdminMode(adminPasswordInput);
      addToast('👑 Admin Mode Activated! Full master privileges unlocked.', 'success');
      setAdminPasswordInput('');
    } catch (err) {
      setUnlockError(err.message || 'Incorrect Admin Password');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleDeactivateAdminMode = () => {
    lockAdminMode();
    addToast('🔒 Admin Mode locked. Returned to Store Counter Mode.', 'info');
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    if (!newAdminPass || newAdminPass.length < 4) {
      addToast('New password must be at least 4 characters long', 'error');
      return;
    }
    if (newAdminPass !== confirmAdminPass) {
      addToast('New passwords do not match', 'error');
      return;
    }

    setChangePassLoading(true);
    try {
      const res = await fetch('/api/auth/change-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentAdminPass,
          newPassword: newAdminPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update admin password');
      }

      addToast('Admin password updated successfully!', 'success');
      setShowChangePassword(false);
      setCurrentAdminPass('');
      setNewAdminPass('');
      setConfirmAdminPass('');
    } catch (err) {
      addToast(err.message || 'Failed to change admin password', 'error');
    } finally {
      setChangePassLoading(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await fetch(`/api/products/categories?businessId=${activeBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoadingCats(false);
    }
  };

  const fetchStaffUsers = async () => {
    setLoadingStaff(true);
    try {
      const res = await fetch(`/api/auth/users?businessId=${activeBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        setStaffUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch staff users:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      addToast('Only Admin/Owner can update business settings', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/businesses/${activeBusiness.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        addToast('Business & Stock settings updated!', 'success');
        triggerRefresh();
      } else {
        addToast('Failed to update settings', 'error');
      }
    } catch (err) {
      addToast('Failed to update settings', 'error');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBusinessId, name: newCatName.trim() }),
      });

      if (res.ok) {
        addToast(`Category "${newCatName}" added!`, 'success');
        setNewCatName('');
        fetchCategories();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to add category', 'error');
      }
    } catch (err) {
      addToast('Error adding category', 'error');
    }
  };

  const handleRenameCategory = async (catId) => {
    if (!editingCatName.trim()) return;

    try {
      const res = await fetch(`/api/products/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCatName.trim() }),
      });

      if (res.ok) {
        addToast('Category renamed successfully!', 'success');
        setEditingCatId(null);
        fetchCategories();
      } else {
        addToast('Failed to rename category', 'error');
      }
    } catch (err) {
      addToast('Error updating category', 'error');
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/products/categories/${cat.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addToast(`Category "${cat.name}" deleted!`, 'success');
        fetchCategories();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Cannot delete category with active products', 'error');
      }
    } catch (err) {
      addToast('Error deleting category', 'error');
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      addToast('Permission Denied: Only Admin / Owner can create or edit stores.', 'error');
      return;
    }

    try {
      const method = editingLocation ? 'PUT' : 'POST';
      const url = editingLocation ? `/api/locations/${editingLocation.id}` : '/api/locations';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...locationForm, businessId: activeBusinessId }),
      });

      if (res.ok) {
        addToast(editingLocation ? 'Location updated!' : 'New store/godown added successfully!', 'success');
        setShowLocationModal(false);
        setEditingLocation(null);
        setLocationForm({ name: '', type: 'STORE', address: '', phone: '', managerName: '' });
        refreshLocations();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to save location', 'error');
      }
    } catch (err) {
      addToast('Failed to save location', 'error');
    }
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    try {
      const method = editingStaff ? 'PUT' : 'POST';
      const url = editingStaff ? `/api/auth/users/${editingStaff.id}` : '/api/auth/users';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...staffForm, businessId: activeBusinessId }),
      });

      if (res.ok) {
        addToast(editingStaff ? 'Staff profile updated!' : 'New employee login created!', 'success');
        setShowStaffModal(false);
        setEditingStaff(null);
        setStaffForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
        fetchStaffUsers();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to save employee', 'error');
      }
    } catch (err) {
      addToast('Failed to save staff user', 'error');
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to remove staff member "${staff.name}"?`)) return;

    try {
      const res = await fetch(`/api/auth/users/${staff.id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('Staff member removed', 'success');
        fetchStaffUsers();
      } else {
        const errJson = await res.json();
        addToast(errJson.error || 'Failed to remove staff', 'error');
      }
    } catch (err) {
      addToast('Error deleting staff', 'error');
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Header */}
      <div className="pb-3 border-b border-zinc-200/80">
        <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-700" />
          <span>Store & System Settings</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5 font-medium">
          Business details, inventory policies, categories, branch stores, and staff permissions.
        </p>
      </div>

      {/* ADMIN MODE SECURITY CONTROL CENTER BANNER */}
      {!isAdmin ? (
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                    Store Counter Mode (Protected)
                  </h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 border border-amber-300/60">
                    READ-ONLY
                  </span>
                </div>
                <p className="text-xs text-amber-800 font-medium mt-0.5 max-w-xl">
                  Business policies, store branch management, and staff accounts are locked. Enter Admin Password to activate Admin Mode.
                </p>
              </div>
            </div>
          </div>

          {/* Inline Unlock Form */}
          <form onSubmit={handleActivateAdminMode} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <div className="relative flex-1 max-w-sm">
              <KeyRound className="w-4 h-4 text-amber-600/70 absolute left-3 top-1/2 -translate-y-1/2 select-none pointer-events-none" />
              <input
                type={showAdminPassword ? 'text' : 'password'}
                value={adminPasswordInput}
                onChange={(e) => {
                  setAdminPasswordInput(e.target.value);
                  if (unlockError) setUnlockError('');
                }}
                placeholder="Enter admin password (e.g. bird123)..."
                className="w-full bg-white border border-amber-300 rounded-xl pl-9 pr-10 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {unlockLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Activate Admin Mode</span>
                </>
              )}
            </button>
          </form>

          {unlockError && (
            <div className="text-xs font-bold text-rose-600">
              ⚠️ {unlockError}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-emerald-950">
                  👑 Admin Mode Active
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                  MASTER ACCESS
                </span>
              </div>
              <p className="text-xs text-emerald-800 font-medium">
                Full edit rights unlocked for business rules, stores, staff, and financial records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-emerald-300 text-emerald-900 text-xs font-bold transition-colors"
            >
              Change Admin Password
            </button>
            <button
              type="button"
              onClick={handleDeactivateAdminMode}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Admin Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* CHANGE ADMIN PASSWORD DRAWER */}
      {isAdmin && showChangePassword && (
        <form onSubmit={handleChangeAdminPassword} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-md space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-zinc-700" />
              <span>Change Master Admin Password</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowChangePassword(false)}
              className="text-zinc-400 hover:text-zinc-600 text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1">Current Password</label>
              <input
                type="password"
                placeholder="Current password"
                value={currentAdminPass}
                onChange={(e) => setCurrentAdminPass(e.target.value)}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1">New Password *</label>
              <input
                type="password"
                required
                placeholder="New password (min 4 chars)"
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                placeholder="Re-type new password"
                value={confirmAdminPass}
                onChange={(e) => setConfirmAdminPass(e.target.value)}
                className="w-full text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={changePassLoading}
              className="btn-primary text-xs"
            >
              {changePassLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveTab('business')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeTab === 'business'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Business & Stock Policy
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeTab === 'categories'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Stock Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeTab === 'locations'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Stores & Godowns ({locations.length})
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'staff'
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <span>{isAdmin ? '👑' : '🔒'} Staff & Logins ({staffUsers.length})</span>
        </button>
      </div>

      {/* TAB 1: BUSINESS & STOCK POLICY */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveSettings} className="bird-card p-5 space-y-4">
          {!isAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You are viewing settings in Store Counter Mode (Read-Only). Activate Admin Mode above to make changes.</span>
            </div>
          )}

          {/* NEGATIVE STOCK SETTING CARD */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-zinc-900">Allow Negative Stock</h3>
              </div>
              <label className={`relative inline-flex items-center ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={formData.allowNegativeStock}
                  onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-900"></div>
              </label>
            </div>
            <p className="text-xs text-zinc-500 font-medium">
              {formData.allowNegativeStock
                ? 'ON: System will allow stock to go below 0 (e.g. -5 pcs) with a warning badge.'
                : 'OFF (Recommended): System prevents negative billing to protect inventory accuracy.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Business / Shop Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Invoice Bill Prefix</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.billPrefix}
                onChange={(e) => setFormData({ ...formData, billPrefix: e.target.value })}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Phone Number</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Shop Address</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                type="submit"
                className="btn-primary"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Settings</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: STOCK CATEGORIES MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="bird-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Manage Stock Categories</h3>
            <p className="text-xs text-zinc-500 font-medium">Add, rename, or organize spare part categories</p>
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New Category Name (e.g. Back Panels, ICs)..."
              className="flex-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
            <button
              type="submit"
              className="btn-primary shrink-0 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>

          {/* Categories List */}
          <div className="space-y-2 pt-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200/80"
              >
                {editingCatId === cat.id ? (
                  <div className="flex-1 flex items-center gap-2 pr-2">
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      className="flex-1 p-1.5 bg-white border border-zinc-900 rounded-lg text-xs font-bold text-zinc-900"
                    />
                    <button
                      onClick={() => handleRenameCategory(cat.id)}
                      className="p-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="p-1.5 bg-zinc-200 text-zinc-700 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">{cat.name}</h4>
                    <span className="text-[10px] text-zinc-400 font-semibold">{cat._count?.products || 0} items assigned</span>
                  </div>
                )}

                {editingCatId !== cat.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                      }}
                      className="p-2 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-white"
                      title="Rename Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-2 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-white"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STORES & GODOWNS (LOCKED FOR EMPLOYEE, FULL EDIT FOR ADMIN) */}
      {activeTab === 'locations' && (
        <div className="bird-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Stores & Godowns</h3>
              <p className="text-xs text-zinc-500 font-medium">Independent inventory and sales locations</p>
            </div>
            {isAdmin ? (
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setLocationForm({ name: '', type: 'STORE', address: '', phone: '', managerName: '' });
                  setShowLocationModal(true);
                }}
                className="btn-primary text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Store</span>
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-500 text-xs font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Admin Protected
              </span>
            )}
          </div>

          {!isAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Store Management is Restricted to Admin / Owner:</strong> Employees can view active locations for operational billing and stock transfers, but cannot add, rename, or delete stores.
              </span>
            </div>
          )}

          <div className="space-y-2.5">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{loc.type === 'GODOWN' ? '🏭' : '🏪'}</span>
                    <h4 className="text-xs font-bold text-zinc-900">{loc.name}</h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-zinc-200 text-zinc-800">
                      {loc.type}
                    </span>
                  </div>
                  {loc.address && <p className="text-[11px] text-zinc-500">{loc.address}</p>}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingLocation(loc);
                      setLocationForm({
                        name: loc.name,
                        type: loc.type,
                        address: loc.address || '',
                        phone: loc.phone || '',
                        managerName: loc.managerName || '',
                      });
                      setShowLocationModal(true);
                    }}
                    className="p-2 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-white"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STAFF & ROLE MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="bird-card p-5 space-y-4">
          {!isAdmin ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-zinc-900">Staff Management is Locked</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Only Administrators can create and manage employee login credentials and roles. Activate Admin Mode above to manage staff users.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Go to Admin Mode Activation</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Staff & Employee Management</h3>
                  <p className="text-xs text-zinc-500 font-medium">Create staff logins and manage operational permissions</p>
                </div>
                <button
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
                    setShowStaffModal(true);
                  }}
                  className="btn-primary text-xs flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Employee</span>
                </button>
              </div>
            </>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-400 font-semibold">
                  <th className="pb-2.5">Staff Name</th>
                  <th className="pb-2.5">Email / Login</th>
                  <th className="pb-2.5">Role</th>
                  <th className="pb-2.5">Permissions</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {staffUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/80">
                    <td className="py-3 font-bold text-zinc-900 flex items-center gap-2">
                      <span>{u.role === 'OWNER' || u.role === 'ADMIN' ? '👑' : '👤'}</span>
                      <span>{u.name}</span>
                    </td>
                    <td className="py-3 text-zinc-600 font-medium">{u.email}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'OWNER' || u.role === 'ADMIN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-500 text-[11px]">
                      {u.role === 'OWNER' || u.role === 'ADMIN'
                        ? 'Full P&L, Store creation, Settings, All operations'
                        : 'Billing, Inventory updates, Customer khata, Purchases'}
                    </td>
                    <td className="py-3 text-right">
                      {u.email !== 'owner@birdparts.com' && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingStaff(u);
                              setStaffForm({ name: u.name, email: u.email, password: '', role: u.role });
                              setShowStaffModal(true);
                            }}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
                            title="Edit Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(u)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOCATION EDIT / CREATE MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                {editingLocation ? 'Edit Store Location' : 'Add New Branch Store or Godown'}
              </h3>
              <button onClick={() => setShowLocationModal(false)} className="text-zinc-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Branch / Store Name *</label>
                <input
                  type="text"
                  required
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g. Store 3 / Gaffar Market Branch"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Type</label>
                <select
                  value={locationForm.type}
                  onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="STORE">🏪 Retail Store (Sales, Khata, Customer Bills)</option>
                  <option value="GODOWN">🏭 Godown (Main Stock Inventory Hub)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Store Address</label>
                <input
                  type="text"
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  placeholder="e.g. Shop 12, Main Market, Delhi"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-md"
                >
                  Save Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF CREATE / EDIT MODAL */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                {editingStaff ? 'Edit Staff Profile' : 'Add New Staff / Employee'}
              </h3>
              <button onClick={() => setShowStaffModal(false)} className="text-zinc-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Employee Full Name *</label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Email / Login ID *</label>
                <input
                  type="email"
                  required
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="e.g. rahul@birdparts.com"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  {editingStaff ? 'Password (Leave blank to keep unchanged)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!editingStaff}
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="Enter secure login password"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Role & Permissions *</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="EMPLOYEE">👤 Store Employee (Billing, Stock update, Khata - NO P&L or store edit)</option>
                  <option value="ADMIN">👑 Admin / Manager (Full P&L access, Store creation & edit)</option>
                  <option value="OWNER">👑 Business Owner (Full Unlimited Master Rights)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-md"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
