import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes: instant cached render with background revalidation
      gcTime: 1000 * 60 * 15, // 15 minutes garbage collection cache time
      refetchOnWindowFocus: false, // Prevent jarring refetches on tab switch
      retry: 1,
    },
  },
});
