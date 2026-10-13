import { apiRequest } from './api';

export interface ReviewDto {
  id: string;
  revieweeId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerBusiness?: string;
  jobId: string;
  rating: number;
  text?: string;
  createdAt: string;
  // Only on the submit response; null when no payout was scheduled.
  payoutScheduledAt?: string | null;
}

export interface SubmitReviewPayload {
  rating: number;
  text?: string;
}

export interface SubmitTradesPersonReviewPayload {
  rating: number;
  text?: string;
}

export const reviewService = {
  getReviews: async (userId: string): Promise<ReviewDto[]> => {
    return apiRequest<ReviewDto[]>('GET', `/users/${userId}/reviews`);
  },

  // The server reviews the job's accepted tradesperson, so no reviewee id is sent.
  submitReview: async (jobId: string, payload: SubmitReviewPayload): Promise<ReviewDto> => {
    return apiRequest<ReviewDto>('POST', `/jobs/${jobId}/review`, payload);
  },

  submitTradesPersonReview: async (jobId: string, payload: SubmitTradesPersonReviewPayload): Promise<void> => {
    await apiRequest<void>('POST', `/jobs/${jobId}/tradesperson-review`, payload);
  },
};
