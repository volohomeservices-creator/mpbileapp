import { Platform } from 'react-native';
import firebase from '@react-native-firebase/app';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * Standard Firebase project configuration matching google-services.json for com.volohome.app.
 * All fields including databaseURL and authDomain are defined to prevent
 * Android NoSuchKeyException or validation errors if fallback initialization is required.
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
 * If already initialized by Android's ContentProvider from google-services.json, this is a no-op.
 * If not yet initialized, safely calls firebase.initializeApp() with all required options.
 */
export async function ensureNativeFirebaseApp(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (isNativeFirebaseDefaultAppReady()) {
    return;
  }

  try {
    await firebase.initializeApp(FIREBASE_CONFIG);
  } catch (err: any) {
    if (err?.message && (err.message.includes('already exists') || err.message.includes('[DEFAULT]'))) {
      return;
    }
    console.warn('[Firebase Native Auth] ensureNativeFirebaseApp warning:', err?.message || err);
  }
}

/**
 * Returns the native Firebase Auth instance.
 * Automatically guarantees that the default Firebase app is ready first.
 */
export async function getNativeAuth(): Promise<FirebaseAuthTypes.Module> {
  if (Platform.OS !== 'web') {
    await ensureNativeFirebaseApp();
  }

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
