import { SubscriptionTier } from '@/constants/types';

export type UsageKind = 'posts' | 'applications';

export interface Usage {
  tier: SubscriptionTier;
  postsUsed: number;
  postsLimit: number | null;        // null = unlimited
  applicationsUsed: number;
  applicationsLimit: number | null; // null = unlimited
  periodEnd: string;
}

function counts(usage: Usage, kind: UsageKind) {
  return kind === 'posts'
    ? { used: usage.postsUsed, limit: usage.postsLimit, noun: 'job posts', verb: 'post more' }
    : { used: usage.applicationsUsed, limit: usage.applicationsLimit, noun: 'applications', verb: 'apply for more jobs' };
}

export function isAtLimit(usage: Usage | null, kind: UsageKind): boolean {
  if (!usage) return false;
  const { used, limit } = counts(usage, kind);
  return limit !== null && used >= limit;
}

export function usageBannerText(usage: Usage | null, kind: UsageKind): string | null {
  if (!usage) return null;
  const { used, limit, noun, verb } = counts(usage, kind);
  if (limit === null) return null;
  if (used >= limit) return `You've used all ${limit} ${noun} this month. Upgrade to ${verb}.`;
  return `${limit - used} of ${limit} ${noun} left this month`;
}
