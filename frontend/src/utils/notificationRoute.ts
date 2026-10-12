import { NotificationType } from '@/constants/types';

export function notificationRoute(
  n: { type: NotificationType; linkedId?: string },
  postedJobIds: string[],
): string | null {
  // "review" links to a review id on one path and a job id on the other, so send it to the profile where reviews show
  if (n.type === 'review') return '/(tabs)/profile';
  if (!n.linkedId) return null;
  const id = n.linkedId;

  switch (n.type) {
    case 'application':
      return `/job-applicants/${id}`;
    case 'accepted':
    case 'job_invite':
    case 'payment':
    case 'cancelled':
    case 'job_autocompleted':
      return `/job/${id}`;
    case 'review_required':
      return `/review/${id}`;
    case 'job_completion_pending':
      return postedJobIds.includes(id) ? '/(tabs)/my-jobs' : `/review-poster/${id}`;
    default:
      return null;
  }
}
