import { addToGallery, removeFromGallery, canAddToGallery, MAX_GALLERY } from '@/src/utils/gallery';

const full = Array.from({ length: MAX_GALLERY }, (_, i) => `https://x/${i}.jpg`);

test('adds to the end', () => {
  expect(addToGallery(['a'], 'b')).toEqual(['a', 'b']);
});
test('ignores duplicates', () => {
  expect(addToGallery(['a'], 'a')).toEqual(['a']);
});
test('does not exceed the max', () => {
  expect(addToGallery(full, 'extra')).toHaveLength(MAX_GALLERY);
});
test('removes by index', () => {
  expect(removeFromGallery(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
});
test('out-of-range remove is a no-op', () => {
  expect(removeFromGallery(['a'], 5)).toEqual(['a']);
});
test('canAddToGallery is false when full', () => {
  expect(canAddToGallery(full)).toBe(false);
  expect(canAddToGallery([])).toBe(true);
});
