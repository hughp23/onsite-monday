import { apiRequest } from './api';
import { Job } from '@/constants/types';

export interface CreateJobPayload {
  title: string;
  trade: string;
  location: string;
  postcode: string;
  duration: number;
  days: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dayRate: number;
  description?: string;
  paymentTerms: string;
  photos: string[];
}

interface ApiJob {
  id: string;
  title: string;
  trade: string;
  location: string;
  postcode: string;
  duration: number;
  days: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dayRate: number;
  description?: string;
  postedById: string;
  postedByName: string;
  postedByBusiness?: string;
  paymentTerms: string;
  status: string;
  photos: string[];
  createdAt: string;
  isInterested: boolean;
  interestedCount: number;
  applicantCount: number;
}

function toJob(j: ApiJob): Job {
  return {
    id: j.id,
    title: j.title,
    trade: j.trade,
    location: j.location,
    postcode: j.postcode,
    duration: j.duration,
    days: j.days as Job['days'],
    startDate: j.startDate,
    endDate: j.endDate,
    startTime: j.startTime,
    endTime: j.endTime,
    dayRate: j.dayRate,
    description: j.description ?? '',
    postedById: j.postedById,
    postedByName: j.postedByName,
    postedByBusiness: j.postedByBusiness ?? '',
    paymentTerms: j.paymentTerms,
    status: j.status as Job['status'],
    photos: j.photos,
    createdAt: j.createdAt,
    isInterested: j.isInterested,
    interestedCount: j.interestedCount,
    applicantCount: j.applicantCount,
  };
}

export const jobService = {
  getJobs: async (params?: { trade?: string; location?: string; status?: string }): Promise<Job[]> => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
      : '';
    const data = await apiRequest<ApiJob[]>('GET', `/jobs${qs}`);
    return data.map(toJob);
  },

  getMyPostedJobs: async (): Promise<Job[]> => {
    const data = await apiRequest<ApiJob[]>('GET', '/jobs/my/posted');
    return data.map(toJob);
  },

  getMyAcceptedJobs: async (): Promise<Job[]> => {
    const data = await apiRequest<ApiJob[]>('GET', '/jobs/my/accepted');
    return data.map(toJob);
  },

  getById: async (id: string): Promise<Job> => {
    const data = await apiRequest<ApiJob>('GET', `/jobs/${id}`);
    return toJob(data);
  },

  createJob: async (payload: CreateJobPayload): Promise<Job> => {
    const data = await apiRequest<ApiJob>('POST', '/jobs', payload);
    return toJob(data);
  },

  toggleInterest: async (jobId: string): Promise<Job> => {
    const data = await apiRequest<ApiJob>('POST', `/jobs/${jobId}/interest`);
    return toJob(data);
  },

  acceptApplicant: async (jobId: string, applicantId: string): Promise<Job> => {
    const data = await apiRequest<ApiJob>('PUT', `/jobs/${jobId}/accept`, { applicantId });
    return toJob(data);
  },

  completeJob: async (jobId: string): Promise<Job> => {
    const data = await apiRequest<ApiJob>('PUT', `/jobs/${jobId}/complete`);
    return toJob(data);
  },
};
