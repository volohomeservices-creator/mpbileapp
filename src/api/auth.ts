import { apiGet, apiPost } from '@/api/client';
import { LoginResponse, MobileRefreshResponse, AuthUser } from '@volo/shared-types';

/**
 * Exchange a Firebase ID token for a VOLO JWT.
 * Called after successful Firebase OTP verification.
 */
export async function verifyFirebaseToken(
  idToken: string,
  role: 'customer' | 'worker',
  deviceName?: string
): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/verify-firebase-token', {
    idToken,
    role,
    deviceName: deviceName ?? 'Mobile App',
  });
}

/**
 * Refresh access token using the stored refresh token.
 * Sends token in body (not cookie) for mobile compatibility.
 */
export async function mobileRefresh(refreshToken: string): Promise<MobileRefreshResponse> {
  return apiPost<MobileRefreshResponse>('/api/auth/mobile-refresh', { refreshToken });
}

/**
 * Validate current session and fetch user profile.
 */
export async function getMe(): Promise<AuthUser> {
  return apiGet<AuthUser>('/api/auth/me');
}

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${tenDigits}`;
};

/**
 * Pre-check auth method for a mobile phone number.
 */
export async function preCheck(phone: string): Promise<{
  authMethod: 'pin_required' | 'otp_required' | 'trusted_device';
  isRegistered: boolean;
  hasEmail: boolean;
}> {
  return apiPost('/api/auth/pre-check', {
    phone: formatPhone(phone),
    recaptchaToken: 'BYPASS_TOKEN_VOLO_DEV_SECRET',
  });
}

/**
 * Log in via PIN.
 */
export async function pinLogin(phone: string, pin: string): Promise<LoginResponse> {
  return apiPost('/api/auth/pin-login', {
    phone: formatPhone(phone),
    pin,
    recaptchaToken: 'BYPASS_TOKEN_VOLO_DEV_SECRET',
  });
}

/**
 * Configure new PIN.
 */
export async function setPin(pin: string): Promise<{ success: boolean }> {
  return apiPost('/api/auth/set-pin', { pin });
}

