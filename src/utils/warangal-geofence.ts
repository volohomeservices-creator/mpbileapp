/**
 * Single Geographic Reference for VOLO Service Area in Mobile:
 * Only Warangal district coordinates are defined as the operational boundary.
 * Any customer across India can place an order as long as the delivery address
 * is located within Warangal District (within 30km radius).
 */
export const WARANGAL_CENTER = {
  lat: 17.9784,
  lng: 79.5941,
  name: 'Warangal, Telangana',
};

// Operational radius in kilometers covering Greater Warangal Tri-Cities & suburban mandals
export const WARANGAL_SERVICE_RADIUS_KM = 30;

// Safety envelope covering Warangal Urban & Rural mandals
export const WARANGAL_BOUNDS = {
  minLat: 17.8000,
  maxLat: 18.2500,
  minLng: 79.3500,
  maxLng: 79.8000,
};

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a given coordinate pair falls within the Warangal operational zone.
 */
export function isLocationInWarangal(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return false;
  }

  // 1. Distance check from central Warangal anchor (Haversine)
  const distanceKm = calculateDistanceKm(WARANGAL_CENTER.lat, WARANGAL_CENTER.lng, lat, lng);
  if (distanceKm <= WARANGAL_SERVICE_RADIUS_KM) {
    return true;
  }

  // 2. Safety envelope check within Warangal district bounding box
  if (
    lat >= WARANGAL_BOUNDS.minLat &&
    lat <= WARANGAL_BOUNDS.maxLat &&
    lng >= WARANGAL_BOUNDS.minLng &&
    lng <= WARANGAL_BOUNDS.maxLng
  ) {
    return true;
  }

  return false;
}
