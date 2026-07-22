import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

let webAuth: any = null;

export function getWebAuth() {
  if (typeof window === 'undefined') return null;
  if (__DEV__) console.log('[Web Auth] Firebase Config status:', {
    apiKey: firebaseConfig.apiKey ? 'PRESENT' : 'MISSING',
    authDomain: firebaseConfig.authDomain ? 'PRESENT' : 'MISSING',
    projectId: firebaseConfig.projectId ? 'PRESENT' : 'MISSING',
  });
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

  // 1. Create or get recaptcha container
  let container = document.getElementById('recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'recaptcha-container';
    document.body.appendChild(container);
  }
  
  // Reset style and make it visible
  container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:white;padding:20px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);display:block;';
  
  const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'normal',
    callback: () => {
      if (__DEV__) console.log('[Web Auth] reCAPTCHA solved');
    },
    'expired-callback': () => {
      if (__DEV__) console.log('[Web Auth] reCAPTCHA expired');
      try {
        verifier.clear();
      } catch (e) {}
      if (container) container.style.display = 'none';
    }
  });

  try {
    await verifier.render();
    const confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
    
    // Hide container after success
    setTimeout(() => {
      try {
        verifier.clear();
      } catch (e) {}
      if (container) container.style.display = 'none';
    }, 1000);
    
    return confirmationResult;
  } catch (error) {
    try {
      verifier.clear();
    } catch (e) {}
    if (container) container.style.display = 'none';
    throw error;
  }
}
