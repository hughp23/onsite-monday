import { apiRequest } from './api';
import { User } from '@/constants/types';

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  phone?: string;
  trade?: string;
  skills?: string[];
  accreditations?: string[];
  dayRate?: number;
  dayRateVisible?: boolean;
  location?: string;
  travelRadius?: number;
  profileImageUrl?: string;
  gallery?: string[];
}

export interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  phone?: string;
  trade?: string;
  skills: string[];
  accreditations: string[];
  dayRate?: number;
  dayRateVisible: boolean;
  location?: string;
  travelRadius: number;
  rating: number;
  reviewCount: number;
  profileImageUrl?: string;
  gallery: string[];
  isOnboarded: boolean;
  subscription: string;
}

function toUser(u: ApiUser): User {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    businessName: u.businessName ?? '',
    email: u.email,
    phone: u.phone ?? '',
    trade: u.trade ?? '',
    skills: u.skills,
    accreditations: u.accreditations,
    dayRate: u.dayRate ?? 0,
    dayRateVisible: u.dayRateVisible,
    location: u.location ?? '',
    travelRadius: u.travelRadius,
    rating: u.rating,
    reviewCount: u.reviewCount,
    profileImage: u.profileImageUrl ?? null,
    gallery: u.gallery,
    subscription: (u.subscription as User['subscription']) ?? 'bronze',
    isOnboarded: u.isOnboarded,
  };
}

export const userService = {
  getMe: async (): Promise<User> => {
    const data = await apiRequest<ApiUser>('GET', '/users/me');
    return toUser(data);
  },

  updateMe: async (payload: UpdateUserPayload): Promise<User> => {
    const data = await apiRequest<ApiUser>('PUT', '/users/me', payload);
    return toUser(data);
  },

  completeOnboarding: async (): Promise<User> => {
    const data = await apiRequest<ApiUser>('POST', '/users/me/onboard');
    return toUser(data);
  },

  getTradespeople: async (params?: { trade?: string; location?: string }): Promise<ApiUser[]> => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
      : '';
    return apiRequest<ApiUser[]>('GET', `/users/tradespeople${qs}`);
  },

  getById: async (id: string): Promise<ApiUser> => {
    return apiRequest<ApiUser>('GET', `/users/${id}`);
  },
};
