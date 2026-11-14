import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { queryClient } from '@/lib/queryClient';
import { displayInAppNotification } from './InAppNotificationBanner';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * Handles incoming push notifications for foreground, background, and quit states.
 */
export function registerNotificationHandlers() {
  if (Platform.OS === 'web') return () => {};

  // 1. Foreground listener
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    if (__DEV__) console.log('[FCM] Foreground notification received:', remoteMessage);

    let parsedData: Record<string, any> = { ...(remoteMessage.data || {}) };
    if (typeof parsedData.payload === 'string') {
      try {
        const inner = JSON.parse(parsedData.payload);
        parsedData = { ...parsedData, ...inner };
      } catch {}
    }

    // Safety: Verify that notification matches current logged-in user and role
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      const targetUserId = parsedData.userId || parsedData.user_id;
      if (targetUserId && targetUserId !== currentUser.id) {
        if (__DEV__) console.log('[FCM] Ignoring notification for different user:', targetUserId, 'vs current:', currentUser.id);
        return;
      }
      const targetRole = parsedData.role;
      if (targetRole && targetRole !== currentUser.role) {
        if (__DEV__) console.log('[FCM] Ignoring notification for different role:', targetRole, 'vs current:', currentUser.role);
        return;
      }
    }

    const rawTitle = remoteMessage.notification?.title || parsedData.title || 'Notification';
    const rawBody = remoteMessage.notification?.body || parsedData.body || '';
    const rawType = parsedData.type || parsedData.notification_type || '';

    const title = typeof rawTitle === 'string' ? rawTitle : String(rawTitle || 'Notification');
    const body = typeof rawBody === 'string' ? rawBody : String(rawBody || '');
    const notifType = typeof rawType === 'string' ? rawType : String(rawType || '');

    // Immediately invalidate queries so UI state stays 100% in sync
    try {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (notifType.includes('KYC') || title.toLowerCase().includes('kyc') || body.toLowerCase().includes('kyc')) {
        queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['worker-kyc'] });
      }
      const bookingId = parsedData.bookingId || parsedData.booking_id;
      if (bookingId) {
        if (currentUser?.role === 'worker') {
          queryClient.invalidateQueries({ queryKey: ['worker-active-job'] });
          queryClient.invalidateQueries({ queryKey: ['worker-available-jobs'] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
          queryClient.invalidateQueries({ queryKey: ['customer-active-bookings'] });
          queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
        }
      }
    } catch (e) {
      // Invalidation safe catch
    }

    // Display professional floating mobile notification banner
    displayInAppNotification({
      title,
      body,
      type: notifType,
      data: parsedData,
      onPress: () => handleNotificationAction(parsedData),
    });
  });

  // 2. Background click listener
  const unsubscribeBackgroundClick = messaging().onNotificationOpenedApp((remoteMessage) => {
    if (__DEV__) console.log('[FCM] App opened from background state:', remoteMessage);
    handleNotificationAction(remoteMessage.data);
  });

  // 3. Quit state click listener
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        if (__DEV__) console.log('[FCM] App opened from quit state:', remoteMessage);
        handleNotificationAction(remoteMessage.data);
      }
    });

  return () => {
    unsubscribeForeground();
    unsubscribeBackgroundClick();
  };
}

/**
 * Parses notification data payload and routes the user to the correct screen.
 */
function handleNotificationAction(data: any) {
  if (!data) return;

  let parsed: Record<string, any> = { ...data };
  if (typeof parsed.payload === 'string') {
    try {
      const inner = JSON.parse(parsed.payload);
      parsed = { ...parsed, ...inner };
    } catch {}
  }

  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    const targetUserId = parsed.userId || parsed.user_id;
    if (targetUserId && targetUserId !== currentUser.id) return;
    const targetRole = parsed.role;
    if (targetRole && targetRole !== currentUser.role) return;
  }

  const bookingId = parsed.bookingId || parsed.booking_id;
  const role = parsed.role || currentUser?.role;
  const notifType = (parsed.type || parsed.notification_type || '').toUpperCase();

  if (notifType.includes('KYC')) {
    router.push('/(worker)/kyc');
    return;
  }

  if (bookingId) {
    if (role === 'worker') {
      router.push(`/(worker)/jobs/${bookingId}`);
    } else {
      router.push(`/(customer)/bookings/${bookingId}`);
    }
  } else {
    // Fallback to inboxes
    if (role === 'worker') {
      router.push('/(worker)/notifications');
    } else {
      router.push('/(customer)/notifications');
    }
  }
}
