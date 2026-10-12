import { User } from '@/constants/types';

const CHECKS: [string, (u: User) => boolean][] = [
  ['Profile photo', u => !!u.profileImage],
  ['Trade', u => !!u.trade?.trim()],
  ['Skills', u => u.skills.length > 0],
  ['Day rate', u => u.dayRate > 0],
  ['Location', u => !!u.location?.trim()],
  ['Bio', u => !!u.bio?.trim()],
  ['Work gallery', u => u.gallery.length > 0],
];

export function getMissingProfileItems(user: User): string[] {
  return CHECKS.filter(([, ok]) => !ok(user)).map(([label]) => label);
}
