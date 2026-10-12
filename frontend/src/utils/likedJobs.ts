import { Job } from '@/constants/types';

// A liked job is archived once it's no longer open (filled, cancelled or completed)
export function splitLikedJobs(jobs: Job[]) {
  return {
    active: jobs.filter(j => j.status === 'open'),
    archived: jobs.filter(j => j.status !== 'open'),
  };
}
