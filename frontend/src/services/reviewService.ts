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
}

export interface SubmitReviewPayload {
  rating: number;
  text?: string;
  jobId: string;
}

export interface SubmitTradesPersonReviewPayload {
  rating: number;
  text?: string;
}

export const reviewService = {
  getReviews: async (userId: string): Promise<ReviewDto[]> => {
    return apiRequest<ReviewDto[]>('GET', `/users/${userId}/reviews`);
  },

  submitReview: async (userId: string, payload: SubmitReviewPayload): Promise<ReviewDto> => {
    return apiRequest<ReviewDto>('POST', `/users/${userId}/reviews`, payload);
  },

  submitTradesPersonReview: async (jobId: string, payload: SubmitTradesPersonReviewPayload): Promise<void> => {
    await apiRequest<void>('POST', `/jobs/${jobId}/tradesperson-review`, payload);
  },
};
