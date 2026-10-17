import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, initializeRecaptchaConfig } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC7lRr_t9cXvXFx2IbNhJwQg2hRxbs9eQ8',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'volohome-16448.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'volohome-16448',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'volohome-16448.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '608422758746',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:608422758746:web:4596be66d801cae9498b63',
};

let webAuth: any = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

export function getWebAuth() {
  if (typeof window === 'undefined') return null;
  if (__DEV__) {
    console.log('[Web Auth] Firebase Config status:', {
      apiKey: firebaseConfig.apiKey ? 'PRESENT' : 'MISSING',
      authDomain: firebaseConfig.authDomain ? 'PRESENT' : 'MISSING',
      projectId: firebaseConfig.projectId ? 'PRESENT' : 'MISSING',
    });
  }
  if (!webAuth) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    webAuth = getAuth(app);
  }
  return webAuth;
}

export async function sendOtpWeb(phone: string): Promise<any> {
  if (typeof window === 'undefined') return null;

  const auth = getWebAuth();
  if (!auth) throw new Error('Firebase Web Auth failed to initialize');

  // Initialize reCAPTCHA Enterprise config if available
  try {
    await initializeRecaptchaConfig(auth);
  } catch (initErr) {
    console.warn('[Web Auth] initializeRecaptchaConfig notice:', initErr);
  }

  // Clear previous verifier if present
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (_) {}
    recaptchaVerifier = null;
  }

  // 1. Create or get recaptcha container
  let container = document.getElementById('recaptcha-container');
  if (container) {
    container.remove();
  }
  container = document.createElement('div');
  container.id = 'recaptcha-container';
  document.body.appendChild(container);
  
  // Center modal styling
  container.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:white;padding:20px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.25);display:block;';

  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'normal',
    callback: () => {
      if (__DEV__) console.log('[Web Auth] reCAPTCHA solved');
    },
    'expired-callback': () => {
      if (__DEV__) console.log('[Web Auth] reCAPTCHA expired');
      if (recaptchaVerifier) {
        try { recaptchaVerifier.clear(); } catch (_) {}
        recaptchaVerifier = null;
      }
      if (container) container.style.display = 'none';
    },
  });

  try {
    await recaptchaVerifier.render();
    const confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    
    // Hide container after success
    setTimeout(() => {
      if (container) container.style.display = 'none';
    }, 1000);
    
    return confirmationResult;
  } catch (error: any) {
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (_) {}
      recaptchaVerifier = null;
    }
    if (container) container.remove();

    if (error?.code === 'auth/invalid-app-credential') {
      throw new Error(
        'Firebase app verification failed (auth/invalid-app-credential). Please verify: 1) Your domain (localhost / 127.0.0.1) is in Firebase Console -> Authentication -> Settings -> Authorized Domains. 2) If using real SMS, Firebase project is upgraded to the Blaze plan, or use a test phone number configured in Firebase Console.'
      );
    }
    throw error;
  }
}

