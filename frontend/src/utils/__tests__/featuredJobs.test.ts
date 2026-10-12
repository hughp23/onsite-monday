import { selectFeaturedJobs } from '@/src/utils/featuredJobs';
import { Job } from '@/constants/types';

const job = (over: Partial<Job>): Job => ({
  id: Math.random().toString(), title: 't', trade: 'Joiner', location: 'York', postcode: 'YO1',
  duration: 1, days: ['M'], startDate: '', endDate: '', startTime: '', endTime: '', dayRate: 100,
  description: '', postedById: 'other', postedByName: '', postedByBusiness: '', paymentTerms: '',
  status: 'open', photos: [], createdAt: '2026-10-01T00:00:00Z', isInterested: false,
  interestedCount: 0, applicantCount: 0, ...over,
} as Job);

const viewer = { id: 'me', trade: 'Joiner' };

test('excludes own and non-open jobs', () => {
  const r = selectFeaturedJobs([job({ postedById: 'me' }), job({ status: 'accepted' }), job({ id: 'ok' })], viewer);
  expect(r.map(j => j.id)).toEqual(['ok']);
});
test('puts own trade first, then highest day rate', () => {
  const r = selectFeaturedJobs([
    job({ id: 'plumb', trade: 'Plumber', dayRate: 400 }),
    job({ id: 'join-low', dayRate: 150 }),
    job({ id: 'join-high', dayRate: 250 }),
  ], viewer);
  expect(r.map(j => j.id)).toEqual(['join-high', 'join-low', 'plumb']);
});
test('caps at the limit', () => {
  const many = Array.from({ length: 9 }, (_, i) => job({ id: String(i) }));
  expect(selectFeaturedJobs(many, viewer)).toHaveLength(5);
});
test('works with no trade or no viewer', () => {
  expect(selectFeaturedJobs([job({ id: 'a' })], null)).toHaveLength(1);
  expect(selectFeaturedJobs([job({ id: 'a' })], { id: 'me', trade: '' })).toHaveLength(1);
});
