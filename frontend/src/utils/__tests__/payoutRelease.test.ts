import { payoutReleaseText } from '@/src/utils/payoutRelease';

describe('payoutReleaseText', () => {
  it('states the amount and the server-scheduled release date', () => {
    expect(payoutReleaseText('2026-10-27T12:00:00Z', 1250))
      .toBe('£1250 will be released to the tradesperson on 27 October 2026.');
  });
  it('returns null when no payout was scheduled', () => {
    expect(payoutReleaseText(null, 1250)).toBeNull();
    expect(payoutReleaseText(undefined, 1250)).toBeNull();
  });
  it('returns null for an unparseable date', () => {
    expect(payoutReleaseText('not-a-date', 1250)).toBeNull();
  });
});
