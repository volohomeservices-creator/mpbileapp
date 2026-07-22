export const MOBILE_CONFIG = {
  // GPS & Tracking configurations
  GPS_MOVING_INTERVAL_MS: 15000,        // GPS watch intervals when moving
  GPS_IDLE_INTERVAL_MS: 60000,          // GPS watch throttled when stationary
  GPS_NEAR_CUSTOMER_INTERVAL_MS: 7000,  // GPS high-frequency updates when <300m away
  GPS_NEAR_CUSTOMER_THRESHOLD_M: 300,   // Distance boundary for customer proximity (meters)
  GPS_DISTANCE_MIN_THRESHOLD_M: 10,     // Displacement threshold to trigger moving updates (meters)

  // API Client variables
  API_TIMEOUT_MS: 15000,                // Timeout limit for server calls
  QUERY_STALE_TIME_MS: 60000,           // React Query stale time for static data (1 min)
  QUERY_GC_TIME_MS: 300000,             // React Query garbage collection time (5 min)

  // File Upload configurations
  UPLOAD_MAX_WIDTH: 1280,               // Maximum scaling width for images (pixels)
  UPLOAD_QUALITY: 0.8,                  // Image compression level (0.0 to 1.0)
  UPLOAD_RETRY_COUNT: 3,                // Number of fallback retry calls on network failure

  // Offline syncing configurations
  SYNC_QUEUE_BATCH_SIZE: 5,             // Number of queued transactions parsed concurrently
  SYNC_RETRY_INTERVAL_MS: 10000,        // Sync retry loop speed when network recovers
};
