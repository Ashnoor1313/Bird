import React from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useLocation } from '../context/LocationContext';
import { usePurchasesData } from '../hooks/useApiQueries';
import { TableSkeletonLoader } from '../components/common/SkeletonLoader';
import { ShoppingBag, ScanLine, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PurchasesPage = () => {
  const { activeBusinessId } = useBusiness();
  const { activeLocationId } = useLocation();
  const navigate = useNavigate();

  const {
    data: purchases = [],
    isLoading: loading,
    isFetching,
    refetch: fetchPurchases,
  } = usePurchasesData(activeBusinessId, activeLocationId);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-zinc-700" />
            <span>Supplier Purchases</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-medium">View purchase bills & import stock via paper bill scanner.</p>
        </div>

        <button
          onClick={() => navigate('/scan-bill')}
          className="btn-primary"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Scan Supplier Bill</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-500 text-xs font-semibold">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-600" />
          Loading purchase records...
        </div>
      ) : purchases.length === 0 ? (
        <div className="bird-card p-12 text-center space-y-3">
          <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-900">No purchases logged</h3>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto font-medium">
            Scan a paper bill or add a purchase order to increase your inventory stock.
          </p>
        </div>
      ) : (
        <div className="bird-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Purchase #</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total (₹)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="font-bold text-zinc-900">#{p.purchaseNo}</td>
                    <td className="text-zinc-500">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                    <td className="font-medium text-zinc-900">{p.supplierName}</td>
                    <td className="text-zinc-500">{p.items.length} Parts</td>
                    <td className="font-bold text-zinc-900 tabular-nums">₹{p.total.toLocaleString('en-IN')}</td>
                    <td>
                      <span className="badge-success">
                        Stock Inward
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;
