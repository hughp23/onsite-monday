import { mergePage } from '@/src/utils/pagination';

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: String(from + i) }));

test('appends a full page and reports more', () => {
  const r = mergePage(ids(20), ids(20, 20), 20);
  expect(r.items).toHaveLength(40);
  expect(r.hasMore).toBe(true);
});
test('short page means no more', () => {
  expect(mergePage(ids(20), ids(5, 20), 20).hasMore).toBe(false);
});
test('dedupes items that shifted between pages', () => {
  const r = mergePage(ids(20), ids(20, 19), 20); // id "19" appears twice
  expect(r.items).toHaveLength(39);
  expect(new Set(r.items.map(i => i.id)).size).toBe(39);
});
