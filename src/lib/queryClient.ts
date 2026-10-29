import { QueryClient } from '@tanstack/react-query';
import { MOBILE_CONFIG } from './mobile-config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      staleTime: MOBILE_CONFIG.QUERY_STALE_TIME_MS,
      gcTime: MOBILE_CONFIG.QUERY_GC_TIME_MS,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
    },
  },
});

export function clearAppQueryCache() {
  try {
    queryClient.clear();
  } catch (e) {
    console.warn('[QueryClient] Failed to clear query cache:', e);
  }
}
