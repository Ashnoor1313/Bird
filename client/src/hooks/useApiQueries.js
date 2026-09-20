import { useQuery } from '@tanstack/react-query';

// Helper for generic JSON fetches
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

const FIVE_MINUTES = 1000 * 60 * 5;
const THIRTY_MINUTES = 1000 * 60 * 30;

/**
 * 1. Dashboard Query
 * Single-call aggregated metrics for Godown or Store
 */
export function useDashboardData(businessId, locationId = 'ALL') {
  return useQuery({
    queryKey: ['dashboard', businessId, locationId],
    queryFn: () => {
      const locQuery = locationId && locationId !== 'ALL' ? `&locationId=${locationId}` : '';
      return fetchJson(`/api/reports/dashboard?businessId=${businessId}${locQuery}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 2. Category Hub Query (Folders / Batteries)
 * Central Single Source of Truth Inventory + Store Data
 */
export function useCategoryHubData(businessId, categoryName, locationId = 'ALL') {
  return useQuery({
    queryKey: ['category-hub', businessId, categoryName, locationId],
    queryFn: () => {
      const locParam = locationId && locationId !== 'ALL' ? `&locationId=${locationId}` : '&locationId=ALL';
      return fetchJson(`/api/reports/category-hub?businessId=${businessId}&categoryName=${categoryName}${locParam}`);
    },
    enabled: !!businessId && !!categoryName,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 3. Customers Query (Loaded on-demand or preloaded)
 */
export function useCustomersData(businessId, locationId = 'ALL', categoryId = 'ALL', search = '', page = 1, limit = 50) {
  return useQuery({
    queryKey: ['customers', businessId, locationId, categoryId, search, page, limit],
    queryFn: () => {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      return fetchJson(`/api/customers?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 4. Suppliers Query (Loaded on-demand or preloaded)
 */
export function useSuppliersData(businessId, locationId = 'ALL', search = '', page = 1, limit = 50) {
  return useQuery({
    queryKey: ['suppliers', businessId, locationId, search, page, limit],
    queryFn: () => {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (search) params.append('search', search);
      return fetchJson(`/api/suppliers?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 5. Sales Query (Recent bills first, cached and preloaded)
 */
export function useSalesData(businessId, locationId = 'ALL', categoryId = 'ALL', search = '', page = 1, limit = 50) {
  return useQuery({
    queryKey: ['sales', businessId, locationId, categoryId, search, page, limit],
    queryFn: () => {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      return fetchJson(`/api/sales?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 6. Purchases Query
 */
export function usePurchasesData(businessId, locationId = 'ALL', categoryId = 'ALL', search = '', page = 1, limit = 50) {
  return useQuery({
    queryKey: ['purchases', businessId, locationId, categoryId, search, page, limit],
    queryFn: () => {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      return fetchJson(`/api/purchases?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 7. Money & Balances Query
 */
export function useMoneyBalancesData(businessId, locationId = 'ALL', categoryId = 'ALL') {
  return useQuery({
    queryKey: ['money-balances', businessId, locationId, categoryId],
    queryFn: () => {
      const params = new URLSearchParams({ businessId });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      return fetchJson(`/api/money/balances?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 8. Reports & Analytics Query
 */
export function useReportsData(businessId, type = 'sales', range = 'month', locationId = 'ALL') {
  return useQuery({
    queryKey: ['reports', businessId, type, range, locationId],
    queryFn: () => {
      const params = new URLSearchParams({
        businessId,
        type,
        range,
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      return fetchJson(`/api/reports?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 9. Profit & Loss Query
 */
export function useProfitLossData(businessId, locationId = 'ALL', range = 'month') {
  return useQuery({
    queryKey: ['pnl', businessId, locationId, range],
    queryFn: () => {
      const params = new URLSearchParams({ businessId, range });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      return fetchJson(`/api/reports/pnl?${params.toString()}`);
    },
    enabled: !!businessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * ⚡ PRELOAD LAZY ROUTE JS CHUNKS
 * Downloads and parses JavaScript chunks in background so clicking navigation links loads in 0ms!
 */
export function preloadRouteComponents() {
  if (typeof window === 'undefined') return;
  const loadChunks = () => {
    import('../pages/FoldersStockPage');
    import('../pages/BatteriesStockPage');
    import('../pages/SalesPage');
    import('../pages/StockPage');
    import('../pages/CustomersPage');
    import('../pages/SuppliersPage');
    import('../pages/MoneyPage');
    import('../pages/ReportsPage');
    import('../pages/SettingsPage');
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadChunks, { timeout: 1500 });
  } else {
    setTimeout(loadChunks, 300);
  }
}

/**
 * ⚡ PREFETCH ALL PRIMARY HUB QUERIES
 * Fetches all hub data in the background into TanStack Query cache
 * so when user clicks ANY option, data renders INSTANTLY with ZERO delay!
 */
export function prefetchAllHubData(queryClient, businessId, locationId = 'ALL') {
  if (!queryClient || !businessId) return;

  const locParam = locationId && locationId !== 'ALL' ? `&locationId=${locationId}` : '';

  // 1. Dashboard
  queryClient.prefetchQuery({
    queryKey: ['dashboard', businessId, locationId],
    queryFn: () => fetchJson(`/api/reports/dashboard?businessId=${businessId}${locParam}`),
    staleTime: FIVE_MINUTES,
  });

  // 2. Folders Category Hub
  queryClient.prefetchQuery({
    queryKey: ['category-hub', businessId, 'Folders', locationId],
    queryFn: () => fetchJson(`/api/reports/category-hub?businessId=${businessId}&categoryName=Folders${locParam || '&locationId=ALL'}`),
    staleTime: FIVE_MINUTES,
  });

  // 3. Batteries Category Hub
  queryClient.prefetchQuery({
    queryKey: ['category-hub', businessId, 'Batteries', locationId],
    queryFn: () => fetchJson(`/api/reports/category-hub?businessId=${businessId}&categoryName=Batteries${locParam || '&locationId=ALL'}`),
    staleTime: FIVE_MINUTES,
  });

  // 4. Sales
  queryClient.prefetchQuery({
    queryKey: ['sales', businessId, locationId, 'ALL', '', 1, 50],
    queryFn: () => {
      const params = new URLSearchParams({ businessId, page: '1', limit: '50' });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      return fetchJson(`/api/sales?${params.toString()}`);
    },
    staleTime: FIVE_MINUTES,
  });

  // 5. Customers
  queryClient.prefetchQuery({
    queryKey: ['customers', businessId, locationId, 'ALL', '', 1, 50],
    queryFn: () => {
      const params = new URLSearchParams({ businessId, page: '1', limit: '50' });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      return fetchJson(`/api/customers?${params.toString()}`);
    },
    staleTime: FIVE_MINUTES,
  });

  // 6. Suppliers
  queryClient.prefetchQuery({
    queryKey: ['suppliers', businessId, locationId, '', 1, 50],
    queryFn: () => {
      const params = new URLSearchParams({ businessId, page: '1', limit: '50' });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      return fetchJson(`/api/suppliers?${params.toString()}`);
    },
    staleTime: FIVE_MINUTES,
  });

  // 7. Money Balances
  queryClient.prefetchQuery({
    queryKey: ['money-balances', businessId, locationId, 'ALL'],
    queryFn: () => {
      const params = new URLSearchParams({ businessId });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      return fetchJson(`/api/money/balances?${params.toString()}`);
    },
    staleTime: FIVE_MINUTES,
  });
}
