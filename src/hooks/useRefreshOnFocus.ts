import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Custom hook to run refetch queries when an Expo Router screen gains focus,
 * throttled so rapid forward/backward navigation immediately uses the instant cache.
 */
export function useRefreshOnFocus<T>(refetch: () => Promise<T>, minIntervalMs: number = 45000) {
  const lastRefetchRef = useRef<number>(Date.now());
  const firstTimeRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        lastRefetchRef.current = Date.now();
        return;
      }

      const now = Date.now();
      // Only refetch if at least 45 seconds have elapsed since last fetch
      if (now - lastRefetchRef.current >= minIntervalMs) {
        lastRefetchRef.current = now;
        refetch().catch(() => {});
      }
    }, [refetch, minIntervalMs])
  );
}
