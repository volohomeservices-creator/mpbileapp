// @ts-ignore
import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '@/features/auth/authStore';
import { authEventEmitter } from '@/api/client';
import { LanguageProvider } from '@/i18n/LanguageContext';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore error if already hidden
});

// Global Alert.alert polyfill/patch for React Native Web compatibility
if (Platform.OS === 'web') {
  Alert.alert = (title?: string, message?: string, buttons?: any[]) => {
    const formattedTitle = title ? `[${title}] ` : '';
    const formattedMessage = message || '';
    alert(`${formattedTitle}${formattedMessage}`);
    if (buttons && buttons.length > 0) {
      // Execute primary / positive action callback
      const primaryButton = buttons[buttons.length - 1];
      if (primaryButton && typeof primaryButton.onPress === 'function') {
        primaryButton.onPress();
      }
    }
  };

  // Prevent React DOM "NotFoundError: Failed to execute 'removeChild' on 'Node'" 
  // caused by browser translation extensions or fast screen unmounts
  if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child.parentNode !== this) {
        if (child.parentNode) {
          return child.parentNode.removeChild(child);
        }
        return child;
      }
      return originalRemoveChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(node: T, child: Node | null): T {
      if (child && child.parentNode !== this) {
        return this.appendChild(node);
      }
      return originalInsertBefore.call(this, node, child) as T;
    };
  }
}

// Strip all console outputs in production release builds globally
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}

import { useState } from 'react';
import { BrandIntroScreen } from '@/components/BrandIntroScreen';
import { storage } from '@/utils/storage';

const HAS_SEEN_LAUNCH_KEY = 'volo_has_seen_brand_launch';

import { MOBILE_CONFIG } from '@/lib/mobile-config';
import { setupFcmNotifications, listenForFcmTokenRefresh } from '@/features/notifications/fcmSetup';
import { registerNotificationHandlers } from '@/features/notifications/notificationHandler';

const queryClient = new QueryClient({
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

function AppShell() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, user, loadFromStorage, clearAuth } = useAuthStore();

  // Intro plays on every app startup and page refresh
  const [isIntroComplete, setIsIntroComplete] = useState(false);

  // Clean up legacy persistent skip flag if present
  useEffect(() => {
    storage.deleteItem(HAS_SEEN_LAUNCH_KEY).catch(() => {});
  }, []);

  // Hydrate auth from SecureStore/localStorage on first mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Listen for logout events from 401 interceptor
  useEffect(() => {
    const unsub = authEventEmitter.on('logout', async () => {
      await clearAuth();
      queryClient.clear();
    });
    return unsub;
  }, []);

  // Register push notifications and notification event handlers when authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setupFcmNotifications().catch((err) => {
        if (__DEV__) console.warn('[FCM] Setup error:', err);
      });
      const unsubRefresh = listenForFcmTokenRefresh();
      const unsubHandlers = registerNotificationHandlers();

      return () => {
        unsubRefresh();
        unsubHandlers();
      };
    }
  }, [isAuthenticated, isLoading]);

  // Route guard — hydrates immediately once auth state is checked.
  // We intentionally allow this to route while BrandIntroScreen is playing its 1.5s animation
  // so the home screen mounts behind it, firing queries and rendering skeletons in the background.
  const segmentsJoined = segments.join('/');
  useEffect(() => {
    if (isLoading) return;

    const rootSegment = segments[0];
    const inAuth = rootSegment === '(auth)';
    const inCustomer = rootSegment === '(customer)';
    const inWorker = rootSegment === '(worker)';
    const isAtRoot = !rootSegment || (rootSegment as string) === 'index';

    if (!isAuthenticated) {
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
    } else {
      // Authenticated users
      if (inAuth || isAtRoot) {
        // Do not auto-redirect if user is currently on otp-verify completing verification or setting up new PIN
        if (inAuth && segments[1] === 'otp-verify') {
          return;
        }
        // Redirect to their respective stack
        if (user?.role === 'worker') {
          router.replace('/(worker)/home');
        } else {
          router.replace('/(customer)/home');
        }
      } else if (inCustomer && user?.role && user.role !== 'customer') {
        // Logged in as worker but in customer pages -> redirect to worker home
        router.replace('/(worker)/home');
      } else if (inWorker && user?.role && user.role !== 'worker') {
        // Logged in as customer but in worker pages -> redirect to customer home
        router.replace('/(customer)/home');
      }
    }
  }, [isAuthenticated, isLoading, segmentsJoined, user?.role]);

  // Render the Stack behind the BrandIntroScreen overlay so home pages mount
  // immediately and their data-fetching hooks fire during the 1.5s intro animation.
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="+not-found" />
      </Stack>

      {!isIntroComplete && (
        <BrandIntroScreen 
          isInitializing={isLoading} 
          onExitComplete={() => {
            setIsIntroComplete(true);
            SplashScreen.hideAsync().catch(() => {});
          }} 
        />
      )}
    </View>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <AppShell />
          </QueryClientProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
