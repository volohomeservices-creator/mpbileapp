import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface FastLocationResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  city?: string;
}

// In-memory cache for fast sub-millisecond retrieval
let cachedPosition: FastLocationResult | null = null;
let cachedPositionTimestamp = 0;
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes cache validity

/**
 * Super-fast GPS location retriever:
 * 1. Checks memory cache (0ms)
 * 2. Reads OS hardware lastKnownPositionAsync (10-30ms)
 * 3. Falls back to getCurrentPositionAsync with strict timeout (max 3.5s)
 * 4. Resolves reverse-geocoded address with fallback timeout (max 2.5s)
 */
export async function getFastCurrentLocation(options?: {
  forceFresh?: boolean;
}): Promise<FastLocationResult | null> {
  const now = Date.now();
  if (!options?.forceFresh && cachedPosition && now - cachedPositionTimestamp < CACHE_TTL_MS) {
    return cachedPosition;
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    let lat: number | null = null;
    let lng: number | null = null;

    // Step 1: Instant lock from OS location cache
    if (!options?.forceFresh) {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown?.coords) {
          lat = lastKnown.coords.latitude;
          lng = lastKnown.coords.longitude;
        }
      } catch {
        // continue to fresh fix
      }
    }

    // Step 2: If no cached position, race fresh position with 3.5s timeout
    if (lat === null || lng === null) {
      try {
        const freshPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 3500)
        );
        const freshLocation: any = await Promise.race([freshPromise, timeoutPromise]);
        if (freshLocation?.coords) {
          lat = freshLocation.coords.latitude;
          lng = freshLocation.coords.longitude;
        }
      } catch (err) {
        console.warn('[FastLocation] Fresh position failed, trying lastKnown fallback:', err);
        try {
          const fallback = await Location.getLastKnownPositionAsync({});
          if (fallback?.coords) {
            lat = fallback.coords.latitude;
            lng = fallback.coords.longitude;
          }
        } catch {
          // ignore
        }
      }
    }

    if (lat === null || lng === null) {
      return null;
    }

    const result: FastLocationResult = {
      latitude: lat,
      longitude: lng,
    };

    // Step 3: Fast reverse-geocoding with timeout (max 2.5s)
    try {
      const geoPromise = (async () => {
        if (Platform.OS === 'web') {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            {
              headers: { 'User-Agent': 'VoloHomeServices/1.0 (contact@volo.com)' },
            }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data?.address;
            if (addr) {
              const road = addr.suburb || addr.neighbourhood || addr.village || addr.road;
              const city = addr.city || addr.town || addr.county || addr.state_district;
              return {
                formattedAddress: [road, city].filter(Boolean).join(', '),
                city: city || road || 'Hyderabad',
              };
            }
          }
        } else {
          const geocode = await Location.reverseGeocodeAsync({
            latitude: lat!,
            longitude: lng!,
          });
          if (geocode && geocode.length > 0) {
            const item = geocode[0];
            const road = [item.name, item.street, item.district].filter(Boolean).join(', ');
            const city = item.city || item.subregion || item.region || 'Hyderabad';
            const formatted = [item.name, item.street, item.district, item.city, item.postalCode]
              .filter(Boolean)
              .join(', ');
            return {
              formattedAddress: formatted || [road, city].filter(Boolean).join(', '),
              city,
            };
          }
        }
        return null;
      })();

      const timeoutGeo = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2500)
      );
      const geoResult = await Promise.race([geoPromise, timeoutGeo]);

      if (geoResult) {
        result.formattedAddress = geoResult.formattedAddress;
        result.city = geoResult.city;
      }
    } catch {
      // ignore reverse geocoding failure, coordinates are already secured
    }

    cachedPosition = result;
    cachedPositionTimestamp = Date.now();
    return result;
  } catch (error) {
    console.warn('[FastLocation] Failed to acquire location:', error);
    return null;
  }
}
