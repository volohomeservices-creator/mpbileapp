import { create } from 'zustand';
import { AuthUser } from '@volo/shared-types';
import { SECURE_KEYS, authEventEmitter } from '@/api/client';
import { storage } from '@/utils/storage';
import { Platform } from 'react-native';
import { clearAppQueryCache } from '@/lib/queryClient';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (token: string, refreshToken: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

function getInitialAuth() {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem(SECURE_KEYS.TOKEN);
        const refreshToken = localStorage.getItem(SECURE_KEYS.REFRESH_TOKEN);
        const userStr = localStorage.getItem(SECURE_KEYS.USER);
        if (token && refreshToken && userStr) {
          const user = JSON.parse(userStr) as AuthUser;
          return { token, refreshToken, user, isAuthenticated: true, isLoading: false };
        }
      }
    } catch {}
    return { token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false };
  }
  // Native initial state
  return { token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: true };
}

const initialAuth = getInitialAuth();

export const useAuthStore = create<AuthState>((set) => ({
  ...initialAuth,

  setAuth: async (token, refreshToken, user) => {
    // 1. Wipe any stale queries from previous accounts
    clearAppQueryCache();
    await storage.deleteItem('volo_guidance_cache');

    // 2. Persist new credentials
    await storage.setItem(SECURE_KEYS.TOKEN, token);
    await storage.setItem(SECURE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.setItem(SECURE_KEYS.USER, JSON.stringify(user));
    set({ token, refreshToken, user, isAuthenticated: true, isLoading: false });
  },

  clearAuth: async () => {
    // 1. Clear credentials
    await storage.deleteItem(SECURE_KEYS.TOKEN);
    await storage.deleteItem(SECURE_KEYS.REFRESH_TOKEN);
    await storage.deleteItem(SECURE_KEYS.USER);

    // 2. Clear user-specific caches
    await storage.deleteItem('volo_guidance_cache');
    await storage.deleteItem('volo_worker_service_city');
    await storage.deleteItem('volo_cart_storage');

    // 3. Wipe React Query in-memory cache
    clearAppQueryCache();

    // 4. Clean Firebase session
    try {
      if (Platform.OS !== 'web') {
        const authModule = require('@react-native-firebase/auth').default;
        await authModule().signOut();
      } else {
        const { getAuth, signOut } = require('firebase/auth');
        await signOut(getAuth());
      }
    } catch {}

    // 5. Reset state
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false });
  },

  loadFromStorage: async () => {
    if (Platform.OS === 'web') return; // already loaded synchronously
    try {
      const [token, refreshToken, userStr] = await Promise.all([
        storage.getItem(SECURE_KEYS.TOKEN),
        storage.getItem(SECURE_KEYS.REFRESH_TOKEN),
        storage.getItem(SECURE_KEYS.USER),
      ]);
      if (token && refreshToken && userStr) {
        const user = JSON.parse(userStr) as AuthUser;
        set({ token, refreshToken, user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

