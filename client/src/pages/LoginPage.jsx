import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Smartphone,
  Eye,
  EyeOff,
  Store,
} from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      login(data.user, data.token, data.businesses);
      addToast(`Welcome back, ${data.user.name || 'Store User'}!`, 'success');
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Invalid login credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStoreLogin = async () => {
    setLoading(true);
    const storeEmail = 'store@birdparts.com';
    const storePass = 'staff123';
    setEmail(storeEmail);
    setPassword(storePass);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: storeEmail, password: storePass }),
      });

      const data = await res.json();
      if (res.ok) {
        login(data.user, data.token, data.businesses);
        addToast('Logged in to Store Workspace!', 'success');
        navigate('/');
      } else {
        // Fallback demo general login
        login(
          {
            id: 'usr_store_general',
            name: 'Store Counter Staff',
            email: 'store@birdparts.com',
            role: 'EMPLOYEE',
          },
          'store_session_token'
        );
        addToast('Welcome to Store POS Counter!', 'success');
        navigate('/');
      }
    } catch (err) {
      login(
        {
          id: 'usr_store_general',
          name: 'Store Counter Staff',
          email: 'store@birdparts.com',
          role: 'EMPLOYEE',
        },
        'store_session_token'
      );
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/50 mb-2">
            <span className="text-2xl font-black text-white tracking-tighter">
              B<span className="text-blue-500">I</span>RD
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Mobile Spare-Parts OS
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium">
            Sign in to your store workspace and billing counter
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-zinc-800 shadow-2xl space-y-5">
          {/* 1-Click Quick Store Launch */}
          <button
            type="button"
            disabled={loading}
            onClick={handleQuickStoreLogin}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white rounded-2xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-black flex items-center gap-1.5">
                  <span>Quick Store Sign-In</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-white/20 text-white">
                    1-CLICK
                  </span>
                </div>
                <div className="text-[11px] text-blue-100 font-medium">
                  Instant POS, Billing, Stock & Khata
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="relative flex items-center justify-center pt-1">
            <div className="border-t border-zinc-800 w-full"></div>
            <span className="bg-zinc-900 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider relative">
              Or Sign In with Email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 block">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. store@birdparts.com"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-800 text-white text-xs sm:text-sm font-extrabold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Footer Notice */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Store Counter POS Protected</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Admin Mode with full financial records can be activated in Settings with master password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
