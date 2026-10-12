import { apiRequest } from './api';
import { Usage } from '@/src/utils/tierUsage';

export const usageService = {
  get: (): Promise<Usage> => apiRequest<Usage>('GET', '/subscriptions/usage'),
};
