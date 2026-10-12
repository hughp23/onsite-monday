import { splitLikedJobs } from '@/src/utils/likedJobs';
import { Job } from '@/constants/types';

const j = (id: string, status: Job['status']) => ({ id, status } as Job);

test('open jobs are active, everything else archived', () => {
  const r = splitLikedJobs([j('a', 'open'), j('b', 'accepted'), j('c', 'cancelled'), j('d', 'open')]);
  expect(r.active.map(x => x.id)).toEqual(['a', 'd']);
  expect(r.archived.map(x => x.id)).toEqual(['b', 'c']);
});
