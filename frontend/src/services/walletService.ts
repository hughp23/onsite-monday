import { apiRequest } from './api';
import { WalletDto } from '@/constants/types';

export const walletService = {
  getWallet: (): Promise<WalletDto> => {
    return apiRequest<WalletDto>('GET', '/wallet');
  },

  withdraw: (): Promise<void> => {
    return apiRequest<void>('POST', '/wallet/withdraw');
  },

  setAutoWithdraw: (enabled: boolean): Promise<void> => {
    return apiRequest<void>('PUT', '/wallet/auto-withdraw', { enabled });
  },

  registerBankAccount: (
    sortCode: string,
    accountNumber: string,
    holderName: string,
  ): Promise<void> => {
    return apiRequest<void>('PUT', '/users/me/bank-account', {
      sortCode,
      accountNumber,
      holderName,
    });
  },
};
