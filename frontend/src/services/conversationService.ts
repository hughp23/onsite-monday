import { apiRequest } from './api';
import { Conversation, Message } from '@/constants/types';

interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isRead: boolean;
  sentAt: string;
}

interface ApiConversation {
  id: string;
  participantId: string;
  participantName: string;
  participantImage?: string;
  lastMessage: string;
  lastActivityAt: string;
  unreadCount: number;
  messages: ApiMessage[];
}

function toMessage(m: ApiMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    timestamp: m.sentAt,
    isRead: m.isRead,
  };
}

function toConversation(c: ApiConversation): Conversation {
  return {
    id: c.id,
    participantId: c.participantId,
    participantName: c.participantName,
    participantImage: c.participantImage ?? null,
    lastMessage: c.lastMessage,
    lastMessageTime: c.lastActivityAt,
    unreadCount: c.unreadCount,
    messages: c.messages.map(toMessage),
  };
}

export const conversationService = {
  getConversations: async (): Promise<Conversation[]> => {
    const data = await apiRequest<ApiConversation[]>('GET', '/conversations');
    return data.map(toConversation);
  },

  getOrCreate: async (participantId: string, relatedJobId?: string): Promise<Conversation> => {
    const data = await apiRequest<ApiConversation>('POST', '/conversations', {
      participantId,
      relatedJobId,
    });
    return toConversation(data);
  },

  getById: async (id: string): Promise<Conversation> => {
    const data = await apiRequest<ApiConversation>('GET', `/conversations/${id}`);
    return toConversation(data);
  },

  sendMessage: async (conversationId: string, text: string): Promise<Message> => {
    const data = await apiRequest<ApiMessage>('POST', `/conversations/${conversationId}/messages`, { text });
    return toMessage(data);
  },

  markRead: async (conversationId: string): Promise<void> => {
    await apiRequest<void>('PUT', `/conversations/${conversationId}/read`);
  },
};
