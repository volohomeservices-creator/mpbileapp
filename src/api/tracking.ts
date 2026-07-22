import { apiPost, apiPatch } from '@/api/client';
import { LocationUpdatePayload } from '@volo/shared-types';

/** Send worker location update to the backend. */
export const pushWorkerLocation = (
  payload: LocationUpdatePayload
): Promise<{ success: boolean; activeBookingId?: string }> =>
  apiPost('/api/worker/location', payload);

/** Toggle/update worker status. */
export const updateWorkerStatus = (data: {
  status: 'ONLINE' | 'OFFLINE' | 'VACATION';
  latitude: number | null;
  longitude: number | null;
}): Promise<{ success: boolean }> => apiPatch('/api/worker/status', data);
