import { create } from 'zustand';
import { storage } from '@/utils/storage';
import { Platform } from 'react-native';

const CART_STORAGE_KEY = '@volo_customer_cart';

export interface CartItem {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  estimated_mins?: number;
  category_id?: string;
  category_name?: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  deleteItem: (itemId: string) => void;
  clearCart: () => void;
  
  // Getters
  getItemQuantity: (itemId: string) => number;
  getTotalCount: () => number;
  getTotalPrice: () => number;
  loadFromStorage: () => Promise<void>;
}

const persistCart = async (items: CartItem[]) => {
  try {
    await storage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to persist cart:', err);
  }
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isLoading: false,

  addItem: (item) => {
    const currentItems = get().items;
    const existingIndex = currentItems.findIndex((i) => i.id === item.id);
    const addQty = item.quantity && item.quantity > 0 ? item.quantity : 1;

    let updatedItems: CartItem[];
    if (existingIndex > -1) {
      updatedItems = currentItems.map((i, idx) =>
        idx === existingIndex ? { ...i, quantity: i.quantity + addQty } : i
      );
    } else {
      updatedItems = [...currentItems, { ...item, quantity: addQty }];
    }

    set({ items: updatedItems });
    persistCart(updatedItems);
  },

  removeItem: (itemId) => {
    const currentItems = get().items;
    const existing = currentItems.find((i) => i.id === itemId);
    if (!existing) return;

    let updatedItems: CartItem[];
    if (existing.quantity > 1) {
      updatedItems = currentItems.map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
      );
    } else {
      updatedItems = currentItems.filter((i) => i.id !== itemId);
    }

    set({ items: updatedItems });
    persistCart(updatedItems);
  },

  updateQuantity: (itemId, quantity) => {
    const currentItems = get().items;
    let updatedItems: CartItem[];

    if (quantity <= 0) {
      updatedItems = currentItems.filter((i) => i.id !== itemId);
    } else {
      updatedItems = currentItems.map((i) =>
        i.id === itemId ? { ...i, quantity } : i
      );
    }

    set({ items: updatedItems });
    persistCart(updatedItems);
  },

  deleteItem: (itemId) => {
    const updatedItems = get().items.filter((i) => i.id !== itemId);
    set({ items: updatedItems });
    persistCart(updatedItems);
  },

  clearCart: () => {
    set({ items: [] });
    persistCart([]);
  },

  getItemQuantity: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    return item ? item.quantity : 0;
  },

  getTotalCount: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },

  getTotalPrice: () => {
    return get().items.reduce((total, item) => total + item.base_price * item.quantity, 0);
  },

  loadFromStorage: async () => {
    try {
      set({ isLoading: true });
      const raw = await storage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ items: parsed });
        }
      }
    } catch (err) {
      console.warn('Failed to load cart from storage:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Auto-hydrate cart store upon import
useCartStore.getState().loadFromStorage();
