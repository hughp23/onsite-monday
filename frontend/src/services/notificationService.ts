import { apiRequest } from './api';
import { AppNotification } from '@/constants/types';

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  isRead: boolean;
  linkedId?: string;
  createdAt: string;
}

function toNotification(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    type: n.type as AppNotification['type'],
    title: n.title,
    description: n.description,
    isRead: n.isRead,
    linkedId: n.linkedId,
    timestamp: n.createdAt,
  };
}

export const notificationService = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const data = await apiRequest<ApiNotification[]>('GET', '/notifications');
    return data.map(toNotification);
  },

  markRead: async (id: string): Promise<void> => {
    await apiRequest<void>('PUT', `/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiRequest<void>('PUT', '/notifications/read-all');
  },
};
