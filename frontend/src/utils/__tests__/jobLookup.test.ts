import { resolveJobLookup } from '@/src/utils/jobLookup';
import { Job } from '@/constants/types';

const j = (id: string) => ({ id } as Job);

test('a cached job is used straight away, no fetch', () => {
  expect(resolveJobLookup('a', j('a'), null)).toEqual({ job: j('a'), loading: false, notFound: false, shouldFetch: false });
});

test('the cached job wins over a fetched copy, so context updates show', () => {
  const cached = { ...j('a'), title: 'cached' } as Job;
  expect(resolveJobLookup('a', cached, { id: 'a', job: j('a') }).job).toBe(cached);
});

test('not cached and not fetched yet: loading and should fetch', () => {
  expect(resolveJobLookup('a', undefined, null)).toEqual({ job: undefined, loading: true, notFound: false, shouldFetch: true });
});

test('not cached but fetched: uses the fetched job', () => {
  expect(resolveJobLookup('a', undefined, { id: 'a', job: j('a') })).toEqual({ job: j('a'), loading: false, notFound: false, shouldFetch: false });
});

test('fetch failed: not found', () => {
  expect(resolveJobLookup('a', undefined, { id: 'a', job: null })).toEqual({ job: undefined, loading: false, notFound: true, shouldFetch: false });
});

test('a fetch result for a different id is ignored, so the new id is fetched', () => {
  expect(resolveJobLookup('b', undefined, { id: 'a', job: j('a') })).toEqual({ job: undefined, loading: true, notFound: false, shouldFetch: true });
});

test('no id: not found, nothing to fetch', () => {
  expect(resolveJobLookup(undefined, undefined, null)).toEqual({ job: undefined, loading: false, notFound: true, shouldFetch: false });
});
