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
 * ⚡ Persistent LocalStorage Cache Helpers
 * Gives 0ms instant startup time with stale-while-revalidate background refresh
 */
export function getStoredCache(key) {
  try {
    const raw = localStorage.getItem(`bird_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data !== undefined) return parsed.data;
    }
  } catch {}
  return undefined;
}

export function setStoredCache(key, data) {
  try {
    if (data !== undefined && data !== null) {
      localStorage.setItem(`bird_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    }
  } catch {}
}

/**
 * 1. Dashboard Query
 * Single-call aggregated metrics for Godown or Store
 */
export function useDashboardData(businessId, locationId = 'ALL') {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `dashboard_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}`;

  return useQuery({
    queryKey: ['dashboard', effectiveBusinessId, locationId],
    queryFn: async () => {
      const locQuery = locationId && locationId !== 'ALL' ? `&locationId=${locationId}` : '';
      const result = await fetchJson(`/api/reports/dashboard?businessId=${effectiveBusinessId}${locQuery}`);
      setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => getStoredCache(cacheKey),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 2. Category Hub Query (Folders / Batteries)
 * Central Single Source of Truth Inventory + Store Data
 */
export function useCategoryHubData(businessId, categoryName, locationId = 'ALL') {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `cathub_${effectiveBusinessId || 'def'}_${categoryName}_${locationId || 'ALL'}`;

  return useQuery({
    queryKey: ['category-hub', effectiveBusinessId, categoryName, locationId],
    queryFn: async () => {
      const locParam = locationId && locationId !== 'ALL' ? `&locationId=${locationId}` : '&locationId=ALL';
      const result = await fetchJson(`/api/reports/category-hub?businessId=${effectiveBusinessId}&categoryName=${categoryName}${locParam}`);
      setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId && !!categoryName,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => getStoredCache(cacheKey),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 3. Customers Query (Loaded on-demand or preloaded)
 */
export function useCustomersData(businessId, locationId = 'ALL', categoryId = 'ALL', search = '', page = 1, limit = 50) {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `customers_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}_${categoryId || 'ALL'}_p${page}`;

  return useQuery({
    queryKey: ['customers', effectiveBusinessId, locationId, categoryId, search, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: effectiveBusinessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      const result = await fetchJson(`/api/customers?${params.toString()}`);
      if (!search && page === 1) setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => (!search && page === 1 ? getStoredCache(cacheKey) : undefined),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 4. Suppliers Query (Loaded on-demand or preloaded)
 */
export function useSuppliersData(businessId, locationId = 'ALL', search = '', page = 1, limit = 50) {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `suppliers_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}_p${page}`;

  return useQuery({
    queryKey: ['suppliers', effectiveBusinessId, locationId, search, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: effectiveBusinessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (search) params.append('search', search);
      const result = await fetchJson(`/api/suppliers?${params.toString()}`);
      if (!search && page === 1) setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => (!search && page === 1 ? getStoredCache(cacheKey) : undefined),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 5. Sales Query (Recent bills first, cached and preloaded)
 */
export function useSalesData(businessId, locationId = 'ALL', categoryId = 'ALL', search = '', page = 1, limit = 50) {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `sales_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}_${categoryId || 'ALL'}_p${page}`;

  return useQuery({
    queryKey: ['sales', effectiveBusinessId, locationId, categoryId, search, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: effectiveBusinessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      const result = await fetchJson(`/api/sales?${params.toString()}`);
      if (!search && page === 1) setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => (!search && page === 1 ? getStoredCache(cacheKey) : undefined),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 6. Purchases Query
 */
export function usePurchasesData(businessId, locationId = 'ALL', categoryId = 'ALL', search = '', page = 1, limit = 50) {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `purchases_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}_${categoryId || 'ALL'}_p${page}`;

  return useQuery({
    queryKey: ['purchases', effectiveBusinessId, locationId, categoryId, search, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: effectiveBusinessId,
        page: String(page),
        limit: String(limit),
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      const result = await fetchJson(`/api/purchases?${params.toString()}`);
      if (!search && page === 1) setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => (!search && page === 1 ? getStoredCache(cacheKey) : undefined),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 7. Money & Balances Query
 */
export function useMoneyBalancesData(businessId, locationId = 'ALL', categoryId = 'ALL') {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `money_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}_${categoryId || 'ALL'}`;

  return useQuery({
    queryKey: ['money-balances', effectiveBusinessId, locationId, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams({ businessId: effectiveBusinessId });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
      const result = await fetchJson(`/api/money/balances?${params.toString()}`);
      setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => getStoredCache(cacheKey),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 8. Reports & Analytics Query
 */
export function useReportsData(businessId, type = 'sales', range = 'month', locationId = 'ALL') {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `reports_${effectiveBusinessId || 'def'}_${type}_${range}_${locationId || 'ALL'}`;

  return useQuery({
    queryKey: ['reports', effectiveBusinessId, type, range, locationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: effectiveBusinessId,
        type,
        range,
      });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      const result = await fetchJson(`/api/reports?${params.toString()}`);
      setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => getStoredCache(cacheKey),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 9. Profit & Loss Query
 */
export function useProfitLossData(businessId, locationId = 'ALL', range = 'month') {
  const effectiveBusinessId = businessId || (typeof localStorage !== 'undefined' ? localStorage.getItem('bird_active_business_id') : '');
  const cacheKey = `pnl_${effectiveBusinessId || 'def'}_${locationId || 'ALL'}_${range}`;

  return useQuery({
    queryKey: ['pnl', effectiveBusinessId, locationId, range],
    queryFn: async () => {
      const params = new URLSearchParams({ businessId: effectiveBusinessId, range });
      if (locationId && locationId !== 'ALL') params.append('locationId', locationId);
      const result = await fetchJson(`/api/reports/pnl?${params.toString()}`);
      setStoredCache(cacheKey, result);
      return result;
    },
    enabled: !!effectiveBusinessId,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    initialData: () => getStoredCache(cacheKey),
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
    queryFn: async () => {
      const data = await fetchJson(`/api/reports/dashboard?businessId=${businessId}${locParam}`);
      setStoredCache(`dashboard_${businessId || 'def'}_${locationId || 'ALL'}`, data);
      return data;
    },
    staleTime: FIVE_MINUTES,
  });

  // 2. Folders Category Hub
  queryClient.prefetchQuery({
    queryKey: ['category-hub', businessId, 'Folders', locationId],
    queryFn: async () => {
      const data = await fetchJson(`/api/reports/category-hub?businessId=${businessId}&categoryName=Folders${locParam || '&locationId=ALL'}`);
      setStoredCache(`cathub_${businessId || 'def'}_Folders_${locationId || 'ALL'}`, data);
      return data;
    },
    staleTime: FIVE_MINUTES,
  });

  // 3. Batteries Category Hub
  queryClient.prefetchQuery({
    queryKey: ['category-hub', businessId, 'Batteries', locationId],
    queryFn: async () => {
      const data = await fetchJson(`/api/reports/category-hub?businessId=${businessId}&categoryName=Batteries${locParam || '&locationId=ALL'}`);
      setStoredCache(`cathub_${businessId || 'def'}_Batteries_${locationId || 'ALL'}`, data);
      return data;
    },
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
