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

import { MOBILE_CONFIG } from '@/lib/mobile-config';

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
  const [isIntroComplete, setIsIntroComplete] = useState(false);

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

  // Route guard — only run once auth state is hydrated and intro screen has finished exit animation
  const segmentsJoined = segments.join('/');
  useEffect(() => {
    if (isLoading || !isIntroComplete) return;

    const rootSegment = segments[0];
    const inAuth = rootSegment === '(auth)';
    const inCustomer = rootSegment === '(customer)';
    const inWorker = rootSegment === '(worker)';
    const isAtRoot = !rootSegment || rootSegment === 'index';

    if (!isAuthenticated) {
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
    } else {
      // Authenticated users
      if (inAuth || isAtRoot) {
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
  }, [isAuthenticated, isLoading, isIntroComplete, segmentsJoined, user?.role]);

  // Show the premium Brand Intro Screen while initializing and for at least 3 seconds
  if (!isIntroComplete) {
    return (
      <BrandIntroScreen 
        isInitializing={isLoading} 
        onExitComplete={() => {
          setIsIntroComplete(true);
          SplashScreen.hideAsync().catch(() => {});
        }} 
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(worker)" />
    </Stack>
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
