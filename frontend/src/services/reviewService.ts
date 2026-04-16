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

export const reviewService = {
  getReviews: async (userId: string): Promise<ReviewDto[]> => {
    return apiRequest<ReviewDto[]>('GET', `/users/${userId}/reviews`);
  },

  submitReview: async (userId: string, payload: SubmitReviewPayload): Promise<ReviewDto> => {
    return apiRequest<ReviewDto>('POST', `/users/${userId}/reviews`, payload);
  },
};
