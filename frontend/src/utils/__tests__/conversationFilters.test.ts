import { filterConversations } from '@/src/utils/conversationFilters';
import { Conversation } from '@/constants/types';

const c = (id: string, unreadCount: number, relatedJobId: string | null) =>
  ({ id, unreadCount, relatedJobId } as Conversation);
const list = [c('a', 0, null), c('b', 2, 'job1'), c('c', 1, null)];

test('all', () => expect(filterConversations(list, 'all')).toHaveLength(3));
test('unread', () => expect(filterConversations(list, 'unread').map(x => x.id)).toEqual(['b', 'c']));
test('jobs', () => expect(filterConversations(list, 'jobs').map(x => x.id)).toEqual(['b']));
