import { apiRequest } from './api';

export type AccountStatus = {
  onboardingComplete: boolean;
  accountId: string | null;
};

export const stripeConnectService = {
  getOnboardingLink: (returnUrl: string, refreshUrl: string): Promise<{ onboardingUrl: string }> =>
    apiRequest('POST', '/stripe-connect/onboarding-link', { returnUrl, refreshUrl }),

  getAccountStatus: (): Promise<AccountStatus> =>
    apiRequest('GET', '/stripe-connect/account-status'),
};
