import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { queryClient } from '@/lib/queryClient';
import { displayInAppNotification } from './InAppNotificationBanner';

/**
 * Handles incoming push notifications for foreground, background, and quit states.
 */
export function registerNotificationHandlers() {
  if (Platform.OS === 'web') return () => {};

  // 1. Foreground listener
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    if (__DEV__) console.log('[FCM] Foreground notification received:', remoteMessage);

    const rawTitle = remoteMessage.notification?.title || remoteMessage.data?.title || 'Notification';
    const rawBody = remoteMessage.notification?.body || remoteMessage.data?.body || '';
    const rawType = remoteMessage.data?.type || remoteMessage.data?.notification_type || '';

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
      if (remoteMessage.data?.bookingId) {
        queryClient.invalidateQueries({ queryKey: ['worker-active-job'] });
        queryClient.invalidateQueries({ queryKey: ['worker-available-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
      }
    } catch (e) {
      // Invalidation safe catch
    }

    // Display professional floating mobile notification banner
    displayInAppNotification({
      title,
      body,
      type: notifType,
      data: remoteMessage.data,
      onPress: () => handleNotificationAction(remoteMessage.data),
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

  const { bookingId, role, type } = data;
  const notifType = (type || '').toUpperCase();

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
