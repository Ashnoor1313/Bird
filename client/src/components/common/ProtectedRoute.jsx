import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ShieldAlert, ArrowLeft, Lock, KeyRound, Eye, EyeOff, RefreshCw, Sparkles, Unlock } from 'lucide-react';

/**
 * ProtectedRoute ensures that only authenticated users can access the application.
 */
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * AdminRoute ensures that only ADMIN or OWNER role can access restricted pages (like P&L, Import).
 * Includes an inline instant unlock password prompt if locked.
 */
export const AdminRoute = ({ children }) => {
  const { user, isAdmin, loading, unlockAdminMode } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the admin password');
      return;
    }

    setUnlockLoading(true);
    setError('');

    try {
      await unlockAdminMode(password);
      addToast('👑 Admin Mode Activated! Access granted.', 'success');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Incorrect Admin Password');
    } finally {
      setUnlockLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto my-10 text-center animate-fade-in">
        <div className="bird-card p-6 sm:p-8 bg-white border border-amber-200/90 shadow-xl rounded-3xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
              ADMIN MODE REQUIRED
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
              Unlock Administrator Mode
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
              This area contains financial reports, profit & loss analysis, and business configurations. Enter your master password to continue.
            </p>
          </div>

          {/* Quick Inline Password Unlock Form */}
          <form onSubmit={handleUnlock} className="space-y-3 max-w-sm mx-auto text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Admin Password / PIN</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter admin password..."
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 font-bold transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>Default password:</span>
              <button
                type="button"
                onClick={() => setPassword('bird123')}
                className="font-mono font-bold text-blue-600 hover:underline"
              >
                bird123
              </button>
            </div>

            {error && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={unlockLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {unlockLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Activate Admin Mode & Continue</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary py-2 px-4 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <button
              onClick={() => navigate('/sales')}
              className="btn-secondary py-2 px-4 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <span>Go to Billing POS</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
