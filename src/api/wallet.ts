import { apiGet, apiPost } from '@/api/client';
import { CustomerWallet, WalletResponse } from '@volo/shared-types';

/** Get customer wallet balance and transaction history. */
export const getCustomerWallet = (): Promise<WalletResponse> =>
  apiGet('/api/customer/wallet');

/** Top up customer wallet balance. */
export const topUpCustomerWallet = (amount: number): Promise<any> =>
  apiPost('/api/customer/wallet', { amount });

/** Get worker earnings summary and wallet. */
export const getWorkerEarnings = (): Promise<any> =>
  apiGet('/api/worker/earnings');

/** Top up worker commission wallet balance. */
export const topUpWorkerWallet = (amount: number): Promise<any> =>
  apiPost('/api/worker/earnings', { amount });
