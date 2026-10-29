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
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ success: boolean }> => {
  const pinMatch = data.address?.match(/\b\d{6}\b/);
  return apiPost('/api/customer/addresses', {
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: pinMatch ? pinMatch[0] : '560001',
    ...data,
  });
};

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

/** Customer Referrals API */
export const getCustomerReferrals = (): Promise<{
  code: string | null;
  referrals: any[];
  stats: {
    successCount: number;
    pendingCount: number;
    totalEarned: number;
    pendingAmount: number;
  };
  settings: {
    referrer_reward: number;
    referee_reward: number;
    min_bookings_to_qualify: number;
    min_referrer_orders?: number;
  };
  eligibility?: {
    isEligible: boolean;
    completedOrders: number;
    minReferrerOrders: number;
  };
}> => apiGet('/api/customer/referrals');

/** Worker Referrals API */
export const getWorkerReferrals = (): Promise<{
  code: string | null;
  referrals: any[];
  stats: {
    successCount: number;
    pendingCount: number;
    totalEarned: number;
    pendingAmount: number;
  };
  settings: {
    referrer_reward: number;
    referee_reward: number;
    min_bookings_to_qualify: number;
    min_referrer_bookings?: number;
  };
  eligibility?: {
    isEligible: boolean;
    completedJobs: number;
    minReferrerJobs: number;
  };
}> => apiGet('/api/worker/referrals');

/** Customer Rewards & Volo Coins API */
export const getRewards = (): Promise<{
  coins: number;
  history: Array<{
    id: string;
    amount: number;
    description: string;
    created_at: string;
  }>;
}> => apiGet('/api/customer/rewards');

export const convertRewards = (amountToConvert: number): Promise<{ success: boolean; converted: number }> =>
  apiPost('/api/customer/rewards', { amountToConvert });

/** Customer Reviews API */
export const getCustomerReviews = (): Promise<{ reviews: any[] }> =>
  apiGet('/api/customer/reviews');

/** Set or update Security PIN */
export const setSecurityPin = (pin: string): Promise<{ success: boolean }> =>
  apiPost('/api/auth/set-pin', { pin });

