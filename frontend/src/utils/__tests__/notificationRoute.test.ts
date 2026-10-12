import { notificationRoute } from '@/src/utils/notificationRoute';

const posted = ['p1'];

test.each([
  ['application', 'p1', '/job-applicants/p1'],
  ['accepted', 'j1', '/job/j1'],
  ['job_invite', 'j1', '/job/j1'],
  ['payment', 'j1', '/job/j1'],
  ['cancelled', 'j1', '/job/j1'],
  ['job_autocompleted', 'j1', '/job/j1'],
  ['review_required', 'p1', '/review/p1'],
  ['review', 'r1', '/(tabs)/profile'],
] as const)('%s → %s', (type, linkedId, expected) => {
  expect(notificationRoute({ type, linkedId }, posted)).toBe(expected);
});

test('job_completion_pending: poster goes to My Jobs to mark complete', () => {
  expect(notificationRoute({ type: 'job_completion_pending', linkedId: 'p1' }, posted)).toBe('/(tabs)/my-jobs');
});
test('job_completion_pending: tradesperson goes to the job (it is not complete yet, so cannot be reviewed)', () => {
  expect(notificationRoute({ type: 'job_completion_pending', linkedId: 'j9' }, posted)).toBe('/job/j9');
});
test('no linkedId and not review → null', () => {
  expect(notificationRoute({ type: 'accepted' }, posted)).toBeNull();
});
test('unknown type → null', () => {
  expect(notificationRoute({ type: 'something_new' as never, linkedId: 'x' }, posted)).toBeNull();
});
