import { apiGet, apiPut, apiPatch, apiPost, apiDelete } from '@/api/client';
import { ProfileResponse } from '@volo/shared-types';

/** Get current user's profile. */
export const getProfile = (): Promise<ProfileResponse> =>
  apiGet('/api/customer/profile');

/** Get worker profile. */
export const getWorkerProfile = (): Promise<ProfileResponse> =>
  apiGet('/api/worker/profile');

/** Update customer profile. */
export const updateCustomerProfile = (data: {
  full_name?: string;
  email?: string;
  avatar_url?: string;
}): Promise<{ success: boolean }> => apiPatch('/api/customer/profile', data);

/** Update worker profile. */
export const updateWorkerProfile = (data: {
  full_name?: string;
  email?: string;
  avatar_url?: string;
}): Promise<{ success: boolean }> => apiPatch('/api/worker/profile', data);

/** Fetch saved addresses. */
export const getAddresses = (): Promise<{ addresses: any[] }> =>
  apiGet('/api/customer/addresses');

/** Add a new address location. */
export const addAddress = (data: {
  label: string;
  address: string;
  is_default: boolean;
}): Promise<{ success: boolean }> => apiPost('/api/customer/addresses', data);

/** Delete a saved address. */
export const deleteAddress = (id: string): Promise<{ success: boolean }> =>
  apiDelete(`/api/customer/addresses/${id}`);

/** Set an address as default. */
export const setDefaultAddress = (id: string): Promise<{ success: boolean }> =>
  apiPatch(`/api/customer/addresses/${id}`, { is_default: true });

/** Fetch customer billing invoices. */
export const getInvoices = (): Promise<{ invoices: any[] }> =>
  apiGet('/api/customer/invoices');

/** Soft-delete / deactivate the customer account. */
export const deactivateAccount = (): Promise<{ success: boolean; message?: string }> =>
  apiDelete('/api/customer/profile');

/** Soft-delete / deactivate the worker account. */
export const deactivateWorkerAccount = (): Promise<{ success: boolean; message?: string }> =>
  apiDelete('/api/worker/profile');

export interface WorkerAvailability {
  working_days: string[];
  start_time: string;
  end_time: string;
  vacation_mode: boolean;
  unavailable_dates: string[];
}

/** Get worker availability settings. */
export const getWorkerAvailability = (): Promise<WorkerAvailability> =>
  apiGet('/api/worker/availability');

/** Update worker availability settings. */
export const updateWorkerAvailability = (data: WorkerAvailability): Promise<{ success: boolean }> =>
  apiPut('/api/worker/availability', data);
