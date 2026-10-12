import { Job } from '@/constants/types';

/** Result of fetching a job by id that wasn't in the loaded lists. job is null if the fetch failed. */
export type FetchedJob = { id: string; job: Job | null };

export type JobLookup = {
  job: Job | undefined;
  loading: boolean;
  notFound: boolean;
  shouldFetch: boolean;
};

/**
 * Decides where a screen's job comes from. The loaded lists (jobs board page 1 and My Jobs) win,
 * so in-app updates show; otherwise the job is fetched by id, e.g. when opened from a notification.
 */
export function resolveJobLookup(
  id: string | undefined,
  cached: Job | undefined,
  fetched: FetchedJob | null,
): JobLookup {
  if (!id) return { job: undefined, loading: false, notFound: true, shouldFetch: false };
  if (cached) return { job: cached, loading: false, notFound: false, shouldFetch: false };
  if (fetched?.id === id) {
    return fetched.job
      ? { job: fetched.job, loading: false, notFound: false, shouldFetch: false }
      : { job: undefined, loading: false, notFound: true, shouldFetch: false };
  }
  return { job: undefined, loading: true, notFound: false, shouldFetch: true };
}
