import { apiGet, apiPost } from '@/api/client';
import { CustomerWallet, WalletResponse } from '@volo/shared-types';

/** Get customer wallet balance and transaction history. */
export const getCustomerWallet = (): Promise<WalletResponse> =>
  apiGet('/api/customer/wallet');

/** Top up customer wallet balance (legacy direct - disabled for production). */
export const topUpCustomerWallet = (amount: number): Promise<any> =>
  apiPost('/api/customer/wallet', { amount });

/** Create a Razorpay order for Customer wallet top-up. Returns checkout details. */
export const createCustomerWalletTopUpOrder = (amount: number): Promise<{
  success: boolean;
  error?: string;
  checkout?: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    displayAmount: number;
  };
}> => apiPost('/api/customer/wallet/topup', { amount });

/** Verify Razorpay payment for customer wallet top-up and credit the wallet. */
export const verifyCustomerWalletTopUp = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{
  success: boolean;
  balance?: number;
  amount?: number;
  alreadyProcessed?: boolean;
  error?: string;
}> => apiPost('/api/customer/wallet/verify', payload);


/** Get worker earnings summary and wallet. */
export const getWorkerEarnings = (): Promise<any> =>
  apiGet('/api/worker/earnings');

/** Top up worker commission wallet balance (legacy direct). */
export const topUpWorkerWallet = (amount: number): Promise<any> =>
  apiPost('/api/worker/earnings', { amount });

/** Create a Razorpay order for Captain wallet top-up. Returns checkout details. */
export const createWalletTopUpOrder = (amount: number): Promise<{
  success: boolean;
  error?: string;
  checkout?: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    displayAmount: number;
  };
}> => apiPost('/api/worker/wallet-topup', { amount });

/** Verify Razorpay payment for wallet top-up and credit the wallet. */
export const verifyWalletTopUp = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{
  success: boolean;
  balance?: number;
  amount?: number;
  alreadyProcessed?: boolean;
  error?: string;
}> => apiPost('/api/worker/wallet-topup/verify', payload);
