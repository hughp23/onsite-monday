import { isDefaultJobFilter } from '@/src/utils/jobFilters';

const base = { selectedTrades: [] as string[], location: '', minDayRate: null as number | null };

test('no filters is default', () => {
  expect(isDefaultJobFilter(base, 'Joiner')).toBe(true);
  expect(isDefaultJobFilter(base, undefined)).toBe(true);
});
test('only the user trade selected is default', () => {
  expect(isDefaultJobFilter({ ...base, selectedTrades: ['Joiner'] }, 'Joiner')).toBe(true);
});
test('another or extra trade is not default', () => {
  expect(isDefaultJobFilter({ ...base, selectedTrades: ['Plumber'] }, 'Joiner')).toBe(false);
  expect(isDefaultJobFilter({ ...base, selectedTrades: ['Joiner', 'Plumber'] }, 'Joiner')).toBe(false);
  expect(isDefaultJobFilter({ ...base, selectedTrades: ['Joiner'] }, '')).toBe(false);
});
test('location or rate makes it non-default', () => {
  expect(isDefaultJobFilter({ ...base, location: 'York' }, 'Joiner')).toBe(false);
  expect(isDefaultJobFilter({ ...base, minDayRate: 200 }, 'Joiner')).toBe(false);
});
