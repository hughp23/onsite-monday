export type SubscriptionTier = 'bronze' | 'silver' | 'gold';
export type JobStatus = 'open' | 'applied' | 'accepted' | 'in_progress' | 'completed';
export type DayLetter = 'M' | 'T' | 'W' | 'Th' | 'F' | 'S' | 'Su';
export type NotificationType = 'application' | 'accepted' | 'payment' | 'review' | 'profile_view';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  trade: string;
  skills: string[];
  accreditations: string[];
  dayRate: number;
  dayRateVisible: boolean;
  location: string;
  travelRadius: number;
  rating: number;
  reviewCount: number;
  profileImage: string | null;
  gallery: string[];
  subscription: SubscriptionTier;
  isOnboarded: boolean;
}

export interface Review {
  id: string;
  rating: number;
  text: string;
  reviewerName: string;
  reviewerBusiness: string;
  date: string;
  jobId: string;
}

export interface Tradesperson {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  trade: string;
  skills: string[];
  accreditations: string[];
  dayRate: number;
  dayRateVisible: boolean;
  location: string;
  travelRadius: number;
  rating: number;
  reviewCount: number;
  profileImage: string | null;
  gallery: string[];
  reviews: Review[];
  phone: string;
  email: string;
}

export interface Job {
  id: string;
  title: string;
  trade: string;
  location: string;
  postcode: string;
  duration: number;
  days: DayLetter[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dayRate: number;
  description: string;
  postedById: string;
  postedByName: string;
  postedByBusiness: string;
  paymentTerms: string;
  status: JobStatus;
  interestedCount: number;
  isInterested: boolean;
  applicantCount: number;
  photos: string[];
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantImage: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  linkedId?: string;
}
