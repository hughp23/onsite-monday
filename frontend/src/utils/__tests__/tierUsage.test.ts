import { usageBannerText, isAtLimit, Usage } from '@/src/utils/tierUsage';

const base: Usage = {
  tier: 'bronze', postsUsed: 0, postsLimit: 2,
  applicationsUsed: 0, applicationsLimit: 10, periodEnd: '2026-11-01T00:00:00Z',
};

describe('usageBannerText', () => {
  it('shows remaining applications', () => {
    expect(usageBannerText({ ...base, applicationsUsed: 7 }, 'applications'))
      .toBe('3 of 10 applications left this month');
  });
  it('uses singular for one post left', () => {
    expect(usageBannerText({ ...base, postsUsed: 1 }, 'posts'))
      .toBe('1 of 2 job posts left this month');
  });
  it('prompts upgrade at the limit', () => {
    expect(usageBannerText({ ...base, postsUsed: 2 }, 'posts'))
      .toBe("You've used all 2 job posts this month. Upgrade to post more.");
  });
  it('returns null when unlimited', () => {
    expect(usageBannerText({ ...base, tier: 'gold', postsLimit: null }, 'posts')).toBeNull();
  });
  it('returns null before usage has loaded', () => {
    expect(usageBannerText(null, 'posts')).toBeNull();
  });
});

describe('isAtLimit', () => {
  it('is true when used equals limit', () => {
    expect(isAtLimit({ ...base, applicationsUsed: 10 }, 'applications')).toBe(true);
  });
  it('is false when unlimited', () => {
    expect(isAtLimit({ ...base, applicationsLimit: null, applicationsUsed: 999 }, 'applications')).toBe(false);
  });
  it('is false before usage has loaded', () => {
    expect(isAtLimit(null, 'posts')).toBe(false);
  });
});
