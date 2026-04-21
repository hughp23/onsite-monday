import { apiRequest } from './api';
import { SubscriptionTier } from '@/constants/types';

export interface SubscriptionDto {
  id: string;
  tier: SubscriptionTier;
  payoutDays: number;
  isActive: boolean;
  startedAt: string;
}

export interface SubscriptionCheckoutResponse {
  subscription: SubscriptionDto;
  checkoutUrl: string | null;
}

export const subscriptionService = {
  getCurrent: async (): Promise<SubscriptionDto> => {
    return apiRequest<SubscriptionDto>('GET', '/subscriptions/current');
  },

  update: async (tier: SubscriptionTier): Promise<SubscriptionCheckoutResponse> => {
    return apiRequest<SubscriptionCheckoutResponse>('POST', '/subscriptions', { tier });
  },
};
