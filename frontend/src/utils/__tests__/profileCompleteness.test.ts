import { getMissingProfileItems } from '@/src/utils/profileCompleteness';
import { User } from '@/constants/types';

const complete = {
  profileImage: 'https://x/me.jpg', trade: 'Joiner', skills: ['Second fix'],
  dayRate: 180, location: 'York', bio: 'Joiner of 15 years', gallery: ['https://x/1.jpg'],
} as unknown as User;

test('complete profile has nothing missing', () => {
  expect(getMissingProfileItems(complete)).toEqual([]);
});
test('lists each missing item in display order', () => {
  const u = { ...complete, profileImage: null, skills: [], dayRate: 0, bio: '  ' } as User;
  expect(getMissingProfileItems(u)).toEqual(['Profile photo', 'Skills', 'Day rate', 'Bio']);
});
