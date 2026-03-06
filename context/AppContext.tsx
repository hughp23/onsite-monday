import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Job, Tradesperson, Conversation, AppNotification, Review, SubscriptionTier } from '@/constants/types';
import {
  SEED_TRADESPEOPLE,
  SEED_JOBS,
  SEED_CONVERSATIONS,
  SEED_NOTIFICATIONS,
  SEED_MY_ACCEPTED_JOBS,
  SEED_MY_POSTED_JOBS,
} from '@/data/seedData';

const DEFAULT_USER: User = {
  id: 'user-1',
  firstName: 'Dave',
  lastName: 'Mitchell',
  businessName: 'DM Construction',
  email: 'dave@dmconstruction.co.uk',
  phone: '07891234567',
  trade: 'Builder',
  skills: ['Bricklaying', 'Groundworks', 'Extensions', 'Renovations'],
  accreditations: ['CSCS Card', 'Public Liability Insurance', 'City & Guilds'],
  dayRate: 200,
  dayRateVisible: true,
  location: 'York, UK',
  travelRadius: 25,
  rating: 4.7,
  reviewCount: 23,
  profileImage: null,
  gallery: [],
  subscription: 'silver',
  isOnboarded: true,
};

interface AppContextType {
  currentUser: User;
  isAuthenticated: boolean;
  tradespeople: Tradesperson[];
  jobs: Job[];
  myJobs: { accepted: Job[]; posted: Job[] };
  conversations: Conversation[];
  notifications: AppNotification[];
  signIn: () => void;
  signOut: () => void;
  updateCurrentUser: (updates: Partial<User>) => void;
  toggleJobInterest: (jobId: string) => void;
  addJob: (job: Job) => void;
  acceptJob: (jobId: string) => void;
  markJobComplete: (jobId: string) => void;
  submitReview: (tradespersonId: string, review: Omit<Review, 'id'>) => void;
  sendMessage: (conversationId: string, text: string) => void;
  markConversationRead: (conversationId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  updateSubscription: (tier: SubscriptionTier) => void;
  getUnreadNotificationCount: () => number;
  getTradesperson: (id: string) => Tradesperson | undefined;
  getJob: (id: string) => Job | undefined;
  getConversation: (id: string) => Conversation | undefined;
  getUnreadMessageCount: () => number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tradespeople, setTradespeople] = useState<Tradesperson[]>(SEED_TRADESPEOPLE);
  const [jobs, setJobs] = useState<Job[]>(SEED_JOBS);
  const [myJobs, setMyJobs] = useState<{ accepted: Job[]; posted: Job[] }>({
    accepted: SEED_MY_ACCEPTED_JOBS,
    posted: SEED_MY_POSTED_JOBS,
  });
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);

  const signIn = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const updateCurrentUser = useCallback((updates: Partial<User>) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleJobInterest = useCallback((jobId: string) => {
    setJobs(prev =>
      prev.map(job =>
        job.id === jobId
          ? {
              ...job,
              isInterested: !job.isInterested,
              interestedCount: job.isInterested ? job.interestedCount - 1 : job.interestedCount + 1,
            }
          : job
      )
    );
  }, []);

  const addJob = useCallback((job: Job) => {
    setJobs(prev => [job, ...prev]);
    setMyJobs(prev => ({ ...prev, posted: [job, ...prev.posted] }));
  }, []);

  const acceptJob = useCallback((jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      const acceptedJob = { ...job, status: 'accepted' as const, isInterested: true };
      setMyJobs(prev => ({ ...prev, accepted: [...prev.accepted, acceptedJob] }));
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'accepted' as const } : j));
    }
  }, [jobs]);

  const markJobComplete = useCallback((jobId: string) => {
    setMyJobs(prev => ({
      ...prev,
      accepted: prev.accepted.map(j => j.id === jobId ? { ...j, status: 'completed' as const } : j),
    }));
  }, []);

  const submitReview = useCallback((tradespersonId: string, review: Omit<Review, 'id'>) => {
    const newReview: Review = { ...review, id: `rev-${Date.now()}` };
    setTradespeople(prev =>
      prev.map(tp =>
        tp.id === tradespersonId
          ? {
              ...tp,
              reviews: [...tp.reviews, newReview],
              reviewCount: tp.reviewCount + 1,
              rating: parseFloat(
                ((tp.rating * tp.reviewCount + review.rating) / (tp.reviewCount + 1)).toFixed(1)
              ),
            }
          : tp
      )
    );
  }, []);

  const sendMessage = useCallback((conversationId: string, text: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'user-1',
      text,
      timestamp: new Date().toISOString(),
      isRead: true,
    };
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessage: text,
              lastMessageTime: newMessage.timestamp,
            }
          : conv
      )
    );
  }, []);

  const markConversationRead = useCallback((conversationId: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? {
              ...conv,
              unreadCount: 0,
              messages: conv.messages.map(m => ({ ...m, isRead: true })),
            }
          : conv
      )
    );
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  }, []);

  const updateSubscription = useCallback((tier: SubscriptionTier) => {
    setCurrentUser(prev => ({ ...prev, subscription: tier }));
  }, []);

  const getUnreadNotificationCount = useCallback(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const getUnreadMessageCount = useCallback(() => {
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }, [conversations]);

  const getTradesperson = useCallback(
    (id: string) => tradespeople.find(tp => tp.id === id),
    [tradespeople]
  );

  const getJob = useCallback(
    (id: string) => [...jobs, ...myJobs.accepted, ...myJobs.posted].find(j => j.id === id),
    [jobs, myJobs]
  );

  const getConversation = useCallback(
    (id: string) => conversations.find(c => c.id === id),
    [conversations]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        tradespeople,
        jobs,
        myJobs,
        conversations,
        notifications,
        signIn,
        signOut,
        updateCurrentUser,
        toggleJobInterest,
        addJob,
        acceptJob,
        markJobComplete,
        submitReview,
        sendMessage,
        markConversationRead,
        markNotificationRead,
        updateSubscription,
        getUnreadNotificationCount,
        getTradesperson,
        getJob,
        getConversation,
        getUnreadMessageCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContextProvider');
  return ctx;
}
