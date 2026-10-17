/**
 * Resolves media paths and Supabase storage keys into full public CDN URLs.
 */
export function getPublicMediaUrl(
  pathOrUrl: string | null | undefined,
  defaultBucket: 'profile-images' | 'kyc-docs' | 'service-images' | 'services' | 'banners' = 'profile-images'
): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  // Already a full HTTP URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Prepend Supabase public storage endpoint
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ruavhqfttentcjtmnlct.supabase.co';
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${supabaseUrl}/storage/v1/object/public/${defaultBucket}/${cleanPath}`;
}
