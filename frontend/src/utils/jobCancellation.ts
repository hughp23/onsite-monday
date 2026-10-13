import { Job } from '@/constants/types';

export type JobRole = 'poster' | 'tradesperson';

// Local calendar date as YYYY-MM-DD, comparable with Job.startDate.
function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Mirrors JobService.CancelJobAsync so the button is only offered when the
// server will accept it; the server stays the authority (it uses UK dates).
export function canCancelJob(job: Job, role: JobRole, today: Date = new Date()): boolean {
  if (job.status === 'accepted') return true;
  if (job.status !== 'in_progress') return false;
  if (job.paymentStatus !== 'escrowed') return true;
  // Paid: once work has started only the tradesperson can cancel.
  return role === 'tradesperson' || isoDate(today) < job.startDate.slice(0, 10);
}

export function cancelJobDescription(job: Job | null, escrowEnabled: boolean): string {
  if (!escrowEnabled) {
    return 'This cannot be undone. The tradesperson will be notified that the job has been cancelled.';
  }
  if (job?.paymentStatus === 'escrowed') {
    const total = (job.dayRate * (job.duration || 1)).toLocaleString('en-GB');
    return `This cannot be undone. The £${total} payment will be refunded in full to the job poster.`;
  }
  if (job?.paymentStatus === 'payin_pending') {
    return 'This cannot be undone. The payment link will be closed, so no payment will be taken.';
  }
  return 'This cannot be undone. No payment has been taken for this job.';
}
