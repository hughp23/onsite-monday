import { Conversation } from '@/constants/types';

export type ConversationFilter = 'all' | 'unread' | 'jobs';

export const CONVERSATION_FILTER_LABELS: Record<ConversationFilter, string> = {
  all: 'All',
  unread: 'Unread',
  jobs: 'Job chats',
};

export function filterConversations(list: Conversation[], filter: ConversationFilter): Conversation[] {
  if (filter === 'unread') return list.filter(c => c.unreadCount > 0);
  if (filter === 'jobs') return list.filter(c => !!c.relatedJobId);
  return list;
}
