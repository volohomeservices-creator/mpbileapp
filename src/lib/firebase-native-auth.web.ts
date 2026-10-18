/**
 * Web stub for native Firebase modules.
 * Allows clean, statically resolvable imports on native platforms without
 * crashing the Metro bundler or Webpack on web.
 */

export async function getNativeAuth(): Promise<any> {
  return null;
}

export function getNativeMessaging(): null {
  return null;
}

export function isNativeFirebaseDefaultAppReady(): boolean {
  return false;
}

export async function ensureNativeFirebaseApp(): Promise<void> {
  return;
}
