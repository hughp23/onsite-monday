import { Job } from '@/constants/types';

export function selectFeaturedJobs(
  jobs: Job[],
  viewer: { id: string; trade: string } | null,
  limit = 5,
): Job[] {
  const trade = viewer?.trade?.trim();
  return jobs
    .filter(j => j.status === 'open' && j.postedById !== viewer?.id)
    .sort((a, b) => {
      const aMatch = trade && a.trade === trade ? 1 : 0;
      const bMatch = trade && b.trade === trade ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      if (a.dayRate !== b.dayRate) return b.dayRate - a.dayRate;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}
