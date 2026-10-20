import { Platform } from 'react-native';
import firebase from '@react-native-firebase/app';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * Standard Firebase project configuration matching google-services.json for com.volohome.app.
 * Retained for reference and manual fallback if Android native initialization is delayed.
 */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC7lRr_t9cXvXFx2IbNhJwQg2hRxbs9eQ8',
  appId: '1:608422758746:android:b265c37c974a37b6498b63',
  projectId: 'volohome-16448',
  messagingSenderId: '608422758746',
  storageBucket: 'volohome-16448.firebasestorage.app',
  databaseURL: 'https://volohome-16448-default-rtdb.firebaseio.com',
  authDomain: 'volohome-16448.firebaseapp.com',
};

/**
 * Checks if the native default Firebase app is already initialized.
 */
export function isNativeFirebaseDefaultAppReady(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const apps = firebase.apps || [];
    return apps.some((app: any) => app.name === '[DEFAULT]' || app.name === 'DEFAULT');
  } catch {
    return false;
  }
}

/**
 * Ensures that the native default Firebase app is initialized.
 * On Android, the Google Services Gradle plugin and FirebaseInitProvider automatically
 * initialize the default app natively from google-services.json at startup.
 */
export async function ensureNativeFirebaseApp(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (isNativeFirebaseDefaultAppReady()) {
    return;
  }

  try {
    // Resolving firebase.app() verifies and binds the native default app to JS
    firebase.app();
  } catch (err: any) {
    if (err?.message && (err.message.includes('already exists') || err.message.includes('[DEFAULT]'))) {
      return;
    }
    // If not initialized natively, fallback to explicit initialization
    try {
      await firebase.initializeApp(FIREBASE_CONFIG);
    } catch (initErr: any) {
      if (!initErr?.message?.includes('already exists')) {
        console.warn('[Firebase Native Auth] ensureNativeFirebaseApp warning:', initErr?.message || initErr);
      }
    }
  }
}

/**
 * Returns the native Firebase Auth instance using the supported public API: auth().
 * Automatically guarantees that the default Firebase app is ready first.
 */
export async function getNativeAuth(): Promise<FirebaseAuthTypes.Module> {
  if (Platform.OS === 'web') {
    throw new Error('getNativeAuth should not be called on web.');
  }

  await ensureNativeFirebaseApp();

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
 * Requests an SMS OTP using the official supported @react-native-firebase/auth API:
 * auth().signInWithPhoneNumber(phoneNumber, forceResend)
 * 
 * Returns the genuine ConfirmationResult instance from Firebase Auth.
 */
export async function sendNativePhoneOtp(
  phoneNumber: string,
  forceResend = false
): Promise<FirebaseAuthTypes.ConfirmationResult> {
  if (Platform.OS === 'web') {
    throw new Error('sendNativePhoneOtp should only be called on native platforms.');
  }

  await ensureNativeFirebaseApp();
  const nativeAuth = await getNativeAuth();

  // Safe masked diagnostic log (e.g. +91******4905) - never logs full phone or OTP
  const maskedPhone = phoneNumber.length > 7
    ? `${phoneNumber.slice(0, 3)}******${phoneNumber.slice(-4)}`
    : '***';
  console.log(`[Firebase Native Auth] Requesting phone OTP for ${maskedPhone} (forceResend: ${forceResend})`);

  try {
    return await nativeAuth.signInWithPhoneNumber(phoneNumber, forceResend);
  } catch (err: any) {
    const rawCode = String(err?.code || err?.nativeErrorCode || '');
    const rawMessage = String(err?.message || err?.nativeErrorMessage || 'Phone verification failed');
    console.warn(`[Firebase Native Auth] signInWithPhoneNumber failed: [${rawCode}] ${rawMessage}`);
    throw err;
  }
}


