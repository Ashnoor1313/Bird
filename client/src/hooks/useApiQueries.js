import { useQuery, useQueryClient } from '@tanstack/react-query';

// Helper for generic JSON fetches
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

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
    refetchOnMount: 'always',
    staleTime: 0,
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
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * 3. Customers Query (Loaded on-demand only when Customers or Store Hub is opened)
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
  });
}

/**
 * 4. Suppliers Query (Loaded on-demand only when Suppliers page is opened)
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
  });
}

/**
 * 5. Sales Query (Recent bills first, loaded on-demand)
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
  });
}

/**
 * 6. Purchases Query (Loaded on-demand)
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
  });
}

/**
 * 7. Money & Balances Query (Loaded on-demand)
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
  });
}

/**
 * 8. Reports & Analytics Query (Loaded only when Reports page is opened)
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
  });
}

/**
 * 9. Profit & Loss Query (Loaded only when Owner opens P&L)
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
  });
}
