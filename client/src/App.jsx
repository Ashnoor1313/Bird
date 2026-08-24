import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { LocationProvider } from './context/LocationContext';
import { ToastProvider } from './context/ToastContext';

import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { PageSkeletonLoader } from './components/common/SkeletonLoader';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute, AdminRoute } from './components/common/ProtectedRoute';

import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { QuickActionModal } from './components/modals/QuickActionModal';

// Route-based Code Splitting / Lazy Loaded Pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const FoldersStockPage = lazy(() => import('./pages/FoldersStockPage'));
const BatteriesStockPage = lazy(() => import('./pages/BatteriesStockPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const CategoryStockPage = lazy(() => import('./pages/CategoryStockPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const ScanBillPage = lazy(() => import('./pages/ScanBillPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const MoneyPage = lazy(() => import('./pages/MoneyPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

import { AdminUnlockModal } from './components/modals/AdminUnlockModal';
import { SplashScreen } from './components/common/SplashScreen';

function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const { adminModalOpen, setAdminModalOpen } = useAuth();
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash screen smoothly on app load
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white relative">
      {/* Brand Opening Splash Transition */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Top Navigation Shell */}
      <Navbar
        onOpenSearch={() => setSearchOpen(true)}
        onOpenQuickAction={() => setQuickActionOpen(true)}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex pb-20 lg:pb-0">
        <Sidebar />

        <main className="flex-1 min-w-0">
          <ErrorBoundary>
            <Suspense fallback={<PageSkeletonLoader />}>
              <Routes>
                {/* General Routes (Accessible immediately upon opening) */}
                <Route path="/" element={<Dashboard onOpenQuickAction={() => setQuickActionOpen(true)} />} />
                <Route path="/folders" element={<FoldersStockPage />} />
                <Route path="/stock/folders" element={<FoldersStockPage />} />
                <Route path="/batteries" element={<BatteriesStockPage />} />
                <Route path="/stock/batteries" element={<BatteriesStockPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/stock/category/:id" element={<CategoryStockPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/scan-bill" element={<ScanBillPage />} />
                <Route path="/scan" element={<ScanBillPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/money" element={<MoneyPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Admin-Only Restricted Routes (Protected with in-app Admin Password Prompt) */}
                <Route
                  path="/pnl"
                  element={
                    <AdminRoute>
                      <ProfitLossPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/profit-loss"
                  element={
                    <AdminRoute>
                      <ProfitLossPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/import"
                  element={
                    <AdminRoute>
                      <ImportPage />
                    </AdminRoute>
                  }
                />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Bar */}
      <MobileBottomNav
        onOpenQuickAction={() => setQuickActionOpen(true)}
        onOpenMore={() => setQuickActionOpen(true)}
      />

      {/* Global Modals */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickActionModal isOpen={quickActionOpen} onClose={() => setQuickActionOpen(false)} />
      <AdminUnlockModal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessProvider>
          <LocationProvider>
            <ToastProvider>
              <Router>
                <Suspense fallback={<PageSkeletonLoader />}>
                  <AppLayout />
                </Suspense>
              </Router>
            </ToastProvider>
          </LocationProvider>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
