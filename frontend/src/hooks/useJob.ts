import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { jobService } from '@/src/services/jobService';
import { FetchedJob, resolveJobLookup } from '@/src/utils/jobLookup';

/** A job by id: from the loaded lists if present, otherwise fetched from the API. */
export function useJob(id: string | undefined) {
  const { getJob } = useApp();
  const [fetched, setFetched] = useState<FetchedJob | null>(null);
  const { job, loading, notFound, shouldFetch } = resolveJobLookup(id, id ? getJob(id) : undefined, fetched);

  useEffect(() => {
    if (!shouldFetch || !id) return;
    let cancelled = false;
    jobService.getById(id).then(
      result => { if (!cancelled) setFetched({ id, job: result }); },
      () => { if (!cancelled) setFetched({ id, job: null }); },
    );
    return () => { cancelled = true; };
  }, [id, shouldFetch]);

  return { job, loading, notFound };
}
