import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';

/**
 * 1. Optimistic Add Customer Mutation
 */
export function useAddCustomerMutation() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async (customerData) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add customer');
      }
      return res.json();
    },
    onMutate: async (newCustomer) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['customers'] });

      // Snapshot previous customers list
      const previousCustomers = queryClient.getQueriesData({ queryKey: ['customers'] });

      // Optimistically update all matching customer queries in cache
      queryClient.setQueriesData({ queryKey: ['customers'] }, (old) => {
        if (!old) return old;
        const fakeCustomer = {
          id: `temp-${Date.now()}`,
          name: newCustomer.name,
          phone: newCustomer.phone || '',
          moneyToReceive: parseFloat(newCustomer.openingBalance) || 0,
          categoryId: newCustomer.categoryId || 'folders',
          locationId: newCustomer.locationId,
          createdAt: new Date().toISOString(),
        };
        if (Array.isArray(old)) {
          return [fakeCustomer, ...old];
        }
        if (old.data && Array.isArray(old.data)) {
          return { ...old, data: [fakeCustomer, ...old.data] };
        }
        return old;
      });

      return { previousCustomers };
    },
    onError: (err, newCustomer, context) => {
      // Revert cache to previous snapshot
      if (context?.previousCustomers) {
        context.previousCustomers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      addToast(err.message || 'Error creating customer', 'error');
    },
    onSuccess: () => {
      addToast('Customer added successfully', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['category-hub'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * 2. Optimistic Stock Adjustment Mutation (+ / -)
 */
export function useAdjustStockMutation() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async (adjustData) => {
      const res = await fetch('/api/products/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustData),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to adjust stock');
      }
      return res.json();
    },
    onMutate: async (adjustData) => {
      await queryClient.cancelQueries({ queryKey: ['category-hub'] });
      await queryClient.cancelQueries({ queryKey: ['dashboard'] });

      const previousHubData = queryClient.getQueriesData({ queryKey: ['category-hub'] });

      // Optimistically update stock count in the hub cache
      queryClient.setQueriesData({ queryKey: ['category-hub'] }, (old) => {
        if (!old || !old.products) return old;
        const delta = adjustData.type === 'ADD' ? adjustData.quantity : -adjustData.quantity;
        const updatedProducts = old.products.map((p) => {
          if (p.id === adjustData.productId) {
            const nextStock = Math.max(0, (p.currentStock || 0) + delta);
            return { ...p, currentStock: nextStock };
          }
          return p;
        });
        return { ...old, products: updatedProducts };
      });

      return { previousHubData };
    },
    onError: (err, adjustData, context) => {
      if (context?.previousHubData) {
        context.previousHubData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      addToast(err.message || 'Failed to adjust stock', 'error');
    },
    onSuccess: (data) => {
      addToast('Stock adjusted successfully', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['category-hub'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/**
 * 3. Optimistic Payment Mutation (Receive / Pay)
 */
export function useAddPaymentMutation() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async (paymentData) => {
      const res = await fetch('/api/money/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to record payment');
      }
      return res.json();
    },
    onSuccess: () => {
      addToast('Payment recorded successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['money-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['category-hub'] });
    },
    onError: (err) => {
      addToast(err.message || 'Error recording payment', 'error');
    },
  });
}
