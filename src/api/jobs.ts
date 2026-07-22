import { apiGet, apiPost, apiPatch } from '@/api/client';
import { Booking, JobListResponse } from '@volo/shared-types';

/** Get available / pending / history jobs for the worker. */
export const getAvailableJobs = (tab?: 'available' | 'history'): Promise<JobListResponse> =>
  apiGet('/api/worker/jobs', { params: { tab: tab === 'history' ? 'history' : 'new' } });

/** Get the worker's current active job. */
export const getCurrentJob = (): Promise<{ job: Booking | null }> =>
  apiGet<JobListResponse>('/api/worker/jobs', { params: { tab: 'active' } }).then((res) => {
    const jobs = res.jobs || [];
    return { job: jobs[0] || null };
  });

/** Get a specific job by ID. */
export const getJobById = (id: string): Promise<{ job: Booking }> =>
  apiGet(`/api/worker/jobs/${id}`);

/** Accept a job offer. */
export const acceptJob = (id: string): Promise<{ success: boolean }> =>
  apiPatch(`/api/worker/jobs/${id}/status`, { status: 'ACCEPTED' });

/** Reject a job offer. */
export const rejectJob = (id: string, reason?: string): Promise<{ success: boolean }> =>
  apiPost(`/api/worker/jobs/${id}/reject`, { reason });

/** Start journey (Worker transitions to ON_THE_WAY). */
export const startJourney = (id: string): Promise<{ success: boolean }> =>
  apiPatch(`/api/worker/jobs/${id}/status`, { status: 'ON_THE_WAY' });

/** Mark arrived (Worker transitions to ARRIVED). */
export const markArrived = (id: string): Promise<{ success: boolean }> =>
  apiPatch(`/api/worker/jobs/${id}/status`, { status: 'ARRIVED' });

/** Mark job as started (worker arrived + OTP verified). */
export const startJob = (id: string, otp: string): Promise<{ success: boolean }> =>
  apiPost(`/api/worker/jobs/${id}/verify-otp`, { otp });

/** Mark job as completed. */
export const completeJob = (id: string): Promise<{ success: boolean }> =>
  apiPatch(`/api/worker/jobs/${id}/status`, { status: 'COMPLETED' });

/** Get worker dashboard data. */
export const getWorkerDashboard = (): Promise<any> =>
  apiGet('/api/worker/dashboard');

export interface ManualOffer {
  id: string;
  status: string;
  notes: string | null;
  expiresAt: string;
  createdAt: string;
  bookingId: string;
  serviceName: string;
  addressLine: string;
  scheduledAt: string;
  distanceKm: number;
  estimatedEarnings: number;
}

/** Get manual targeted offers for worker. */
export const getManualOffers = (): Promise<{ success: boolean; offers: ManualOffer[] }> =>
  apiGet('/api/worker/manual-offers');

/** Accept a direct manual offer. */
export const acceptManualOffer = (offerId: string): Promise<{ success: boolean }> =>
  apiPost(`/api/worker/manual-offers/${offerId}/accept`);

/** Reject a direct manual offer. */
export const rejectManualOffer = (offerId: string, reason = 'DECLINED_BY_WORKER'): Promise<{ success: boolean }> =>
  apiPost(`/api/worker/manual-offers/${offerId}/reject`, { reason });
