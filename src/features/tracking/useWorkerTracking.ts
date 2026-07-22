import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { pushWorkerLocation } from '@/api/tracking';
import { MOBILE_CONFIG } from '@/lib/mobile-config';
import { monitor } from '@/lib/monitor';
import { offlineSyncManager, QueuePriority } from '@/lib/offline-sync';

const BACKGROUND_TASK_NAME = 'VOLO_BACKGROUND_LOCATION_TASK';

// Define Background task globally (outside the hook)
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }: { data: any; error: any }) => {
    if (error) {
      monitor.logGpsFailure('Background task execution error', error);
      return;
    }
    if (data) {
      const { locations } = data as any;
      if (locations && locations.length > 0) {
        const loc = locations[locations.length - 1];
        
        try {
          await pushWorkerLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
            speed: loc.coords.speed ?? undefined,
            heading: loc.coords.heading ?? undefined,
            deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          });
        } catch (err) {
          // Sync telemetry offline if network fails in background
          await offlineSyncManager.enqueue('/api/worker/location', 'POST', {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
            speed: loc.coords.speed ?? undefined,
            heading: loc.coords.heading ?? undefined,
            deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          }, QueuePriority.LOWEST);
        }
      }
    }
  });
}

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Custom hook to track worker location, manage background task registration,
 * and throttle updates dynamically to conserve battery.
 */
export function useWorkerTracking(
  active: boolean,
  destinationCoords?: { lat: number; lng: number } | null
) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Use mutable refs to prevent watchId/timer leaks
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<any>(null);
  const lastUploadedCoords = useRef<{ lat: number; lng: number } | null>(null);
  const activeRef = useRef(active);

  // Sync ref to prevent stale values inside event loops
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const startTracking = async () => {
      try {
        // Request both foreground and background location permissions
        const foreground = await Location.requestForegroundPermissionsAsync();
        if (foreground.status !== 'granted') {
          setErrorMsg('Foreground location permission denied.');
          return;
        }

        if (Platform.OS !== 'web') {
          const background = await Location.requestBackgroundPermissionsAsync();
          if (background.status !== 'granted') {
            monitor.warn('[Tracking] Background location permission was not granted.');
          }
        }

        // Get initial coordinates
        const initLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const currentCoords = { lat: initLoc.coords.latitude, lng: initLoc.coords.longitude };
        setCoords(currentCoords);

        // Clear any stale watchers first
        if (watchSubscriptionRef.current) {
          watchSubscriptionRef.current.remove();
          watchSubscriptionRef.current = null;
        }

        // 1. Start continuous foreground watch for visual map updating
        watchSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: MOBILE_CONFIG.GPS_DISTANCE_MIN_THRESHOLD_M,
          },
          (newLoc) => {
            setCoords({
              lat: newLoc.coords.latitude,
              lng: newLoc.coords.longitude,
            });
          }
        );

        // 2. Start background updates if native and permitted
        if (Platform.OS !== 'web') {
          const hasBackgroundPermissions = (await Location.getBackgroundPermissionsAsync()).status === 'granted';
          if (hasBackgroundPermissions) {
            const hasTask = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
            if (!hasTask) {
              await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: MOBILE_CONFIG.GPS_MOVING_INTERVAL_MS,
                distanceInterval: MOBILE_CONFIG.GPS_DISTANCE_MIN_THRESHOLD_M,
                foregroundService: {
                  notificationTitle: 'VOLO Duty Mode Active',
                  notificationBody: 'Uploading position telemetry to keep dispatch maps in sync.',
                  notificationColor: '#ff7a00',
                },
              });
              monitor.info('[Tracking] Registered background location tracking task.');
            }
          }
        }

        // 3. Start adaptive uploading loop
        let currentInterval = MOBILE_CONFIG.GPS_MOVING_INTERVAL_MS;

        const uploadTick = async () => {
          if (!activeRef.current) return;

          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const speed = loc.coords.speed || 0; // meters per second

            // Adaptive Interval Calculation
            let nextInterval = MOBILE_CONFIG.GPS_MOVING_INTERVAL_MS;
            
            if (destinationCoords) {
              const distanceToDest = getHaversineDistance(lat, lng, destinationCoords.lat, destinationCoords.lng);
              
              if (distanceToDest < MOBILE_CONFIG.GPS_NEAR_CUSTOMER_THRESHOLD_M) {
                // High frequency updates when approaching customer destination
                nextInterval = MOBILE_CONFIG.GPS_NEAR_CUSTOMER_INTERVAL_MS;
              } else if (speed < 0.5) {
                // Throttle updates when worker is stationary
                nextInterval = MOBILE_CONFIG.GPS_IDLE_INTERVAL_MS;
              }
            } else if (speed < 0.5) {
              nextInterval = MOBILE_CONFIG.GPS_IDLE_INTERVAL_MS;
            }

            // Only upload if coordinate displaced or speed suggests movement
            const lastCoords = lastUploadedCoords.current;
            const displacement = lastCoords ? getHaversineDistance(lat, lng, lastCoords.lat, lastCoords.lng) : 999;

            if (displacement > MOBILE_CONFIG.GPS_DISTANCE_MIN_THRESHOLD_M || speed > 0.5) {
              lastUploadedCoords.current = { lat, lng };
              
              await pushWorkerLocation({
                latitude: lat,
                longitude: lng,
                accuracy: loc.coords.accuracy ?? undefined,
                speed: loc.coords.speed ?? undefined,
                heading: loc.coords.heading ?? undefined,
                deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
              });
            }

            // Stagger next interval check dynamically
            if (nextInterval !== currentInterval) {
              currentInterval = nextInterval;
              clearInterval(timerRef.current);
              timerRef.current = setInterval(uploadTick, currentInterval);
            }

          } catch (err) {
            monitor.logGpsFailure('Adaptive location upload tick exception', err);
          }
        };

        // Initialize adaptive uploading timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(uploadTick, currentInterval);
        
      } catch (err: any) {
        monitor.logGpsFailure('Failed to start tracking loop', err);
        setErrorMsg(err.message || 'Failed to initialize tracking.');
      }
    };

    if (active) {
      startTracking();
    }

    // Comprehensive cleanup function
    return () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // De-register background tasks when shifts terminate
      const stopBackground = async () => {
        if (Platform.OS !== 'web') {
          try {
            const hasTask = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
            if (hasTask) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
              monitor.info('[Tracking] Unregistered background location task.');
            }
          } catch (e) {
            monitor.logGpsFailure('Error stopping background updates', e);
          }
        }
      };
      stopBackground();
    };
  }, [active, destinationCoords?.lat, destinationCoords?.lng]);

  return { coords, errorMsg };
}
