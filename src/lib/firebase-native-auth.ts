import firebase from '@react-native-firebase/app';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * Returns the native Firebase Auth instance.
 * On Android/iOS, native Firebase automatically initializes the default app
 * from google-services.json / GoogleService-Info.plist.
 */
export function getNativeAuth(): FirebaseAuthTypes.Module {
  // 1. Standard default function import: auth()
  if (typeof auth === 'function') {
    return auth();
  }

  // 2. Transpiled CommonJS / ES module interop: auth.default()
  if ((auth as any)?.default && typeof (auth as any).default === 'function') {
    return (auth as any).default();
  }

  // 3. Namespaced root app: firebase.auth()
  if (typeof (firebase as any)?.auth === 'function') {
    return (firebase as any).auth();
  }

  // 4. Fallback: check if auth is already an instance
  if (auth && typeof (auth as any).signInWithPhoneNumber === 'function') {
    return auth as unknown as FirebaseAuthTypes.Module;
  }

  throw new Error('Native Firebase Auth module could not be loaded from @react-native-firebase/auth.');
}

/**
 * Returns the native Firebase Messaging instance for push notifications / FCM.
 */
export function getNativeMessaging(): FirebaseMessagingTypes.Module | null {
  try {
    if (typeof messaging === 'function') {
      return messaging();
    }
    if ((messaging as any)?.default && typeof (messaging as any).default === 'function') {
      return (messaging as any).default();
    }
    if (typeof (firebase as any)?.messaging === 'function') {
      return (firebase as any).messaging();
    }
    return null;
  } catch (err) {
    console.warn('[Firebase Native Messaging] Unable to get messaging instance:', err);
    return null;
  }
}

/**
 * Checks if the native default Firebase app is already initialized.
 */
export function isNativeFirebaseDefaultAppReady(): boolean {
  try {
    const apps = firebase.apps || [];
    return apps.some((app: any) => app.name === '[DEFAULT]' || app.name === 'DEFAULT');
  } catch {
    return false;
  }
}
