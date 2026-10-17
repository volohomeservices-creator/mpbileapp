import { apiGet, apiPatch } from '@/api/client';
import { SettlementsResponse, SettlementLedger } from '@volo/shared-types';

/** Get worker settlement history. */
export const getSettlements = (): Promise<SettlementsResponse> =>
  apiGet('/api/worker/settlements');

/** Get worker payouts list. */
export const getPayouts = (): Promise<any> =>
  apiGet('/api/worker/payouts');

/** Get worker registered bank account & UPI ID. */
export const getWorkerBankAccount = (): Promise<any> =>
  apiGet('/api/worker/bank-accounts');

/** Quick update worker UPI ID for zero-fee instant payouts. */
export const updateWorkerUpiId = (upiId: string): Promise<any> =>
  apiPatch('/api/worker/bank-accounts', { upi_id: upiId });
