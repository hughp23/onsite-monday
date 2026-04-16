import { apiRequest } from './api';
import { SubscriptionTier } from '@/constants/types';

export interface SubscriptionDto {
  id: string;
  tier: SubscriptionTier;
  payoutDays: number;
  isActive: boolean;
  startedAt: string;
}

export const subscriptionService = {
  getCurrent: async (): Promise<SubscriptionDto> => {
    return apiRequest<SubscriptionDto>('GET', '/subscriptions/current');
  },

  update: async (tier: SubscriptionTier): Promise<SubscriptionDto> => {
    return apiRequest<SubscriptionDto>('POST', '/subscriptions', { tier });
  },
};
