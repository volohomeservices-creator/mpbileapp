import { create } from 'zustand';
import { AuthUser } from '@volo/shared-types';
import { SECURE_KEYS } from '@/api/client';
import { storage } from '@/utils/storage';
import { Platform } from 'react-native';

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
    await storage.setItem(SECURE_KEYS.TOKEN, token);
    await storage.setItem(SECURE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.setItem(SECURE_KEYS.USER, JSON.stringify(user));
    set({ token, refreshToken, user, isAuthenticated: true, isLoading: false });
  },

  clearAuth: async () => {
    await storage.deleteItem(SECURE_KEYS.TOKEN);
    await storage.deleteItem(SECURE_KEYS.REFRESH_TOKEN);
    await storage.deleteItem(SECURE_KEYS.USER);
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

