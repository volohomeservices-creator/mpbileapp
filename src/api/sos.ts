import { apiClient } from './client';

export interface SOSTriggerPayload {
  booking_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  reason?: string;
  metadata?: Record<string, any>;
}

export const triggerSOS = async (payload: SOSTriggerPayload) => {
  const { data } = await apiClient.post('/api/sos', payload);
  return data;
};
