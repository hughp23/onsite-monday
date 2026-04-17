import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { User, Job, Tradesperson, Conversation, AppNotification, Review, SubscriptionTier } from '@/constants/types';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/src/services/userService';
import { jobService } from '@/src/services/jobService';
import { conversationService } from '@/src/services/conversationService';
import { notificationService } from '@/src/services/notificationService';
import { subscriptionService } from '@/src/services/subscriptionService';
import { reviewService } from '@/src/services/reviewService';

interface AppContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tradespeople: Tradesperson[];
  jobs: Job[];
  myJobs: { accepted: Job[]; posted: Job[] };
  conversations: Conversation[];
  notifications: AppNotification[];
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  toggleJobInterest: (jobId: string) => Promise<void>;
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'status' | 'interestedCount' | 'isInterested' | 'applicantCount'>) => Promise<void>;
  acceptJob: (jobId: string, applicantId: string) => Promise<void>;
  markJobComplete: (jobId: string) => Promise<void>;
  submitReview: (tradespersonId: string, review: { rating: number; text: string; jobId: string }) => Promise<void>;
  startConversation: (participantId: string, relatedJobId?: string) => Promise<string>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateSubscription: (tier: SubscriptionTier) => Promise<void>;
  loadTradespeople: (params?: { trade?: string; location?: string }) => Promise<void>;
  getUnreadNotificationCount: () => number;
  getUnreadMessageCount: () => number;
  getJob: (id: string) => Job | undefined;
  getConversation: (id: string) => Conversation | undefined;
  fetchConversation: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tradespeople, setTradespeople] = useState<Tradesperson[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<{ accepted: Job[]; posted: Job[] }>({ accepted: [], posted: [] });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load all app data when Firebase user becomes available
  useEffect(() => {
    if (!firebaseUser) {
      setCurrentUser(null);
      setJobs([]);
      setMyJobs({ accepted: [], posted: [] });
      setConversations([]);
      setNotifications([]);
      return;
    }

    const loadAppData = async () => {
      setIsLoading(true);
      try {
        const call = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`${label}: ${msg}`);
          }
        };

        const [user, jobList, acceptedJobs, postedJobs, convs, notifs] = await Promise.all([
          call('getMe', () => userService.getMe()),
          call('getJobs', () => jobService.getJobs()),
          call('getMyAcceptedJobs', () => jobService.getMyAcceptedJobs()),
          call('getMyPostedJobs', () => jobService.getMyPostedJobs()),
          call('getConversations', () => conversationService.getConversations()),
          call('getNotifications', () => notificationService.getNotifications()),
        ]);
        setCurrentUser(user);
        setJobs(jobList);
        setMyJobs({ accepted: acceptedJobs, posted: postedJobs });
        setConversations(convs);
        setNotifications(notifs);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('loadAppData failed:', msg);
        Alert.alert('Load failed', msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppData();
  }, [firebaseUser]);

  const updateCurrentUser = useCallback(async (updates: Partial<User>) => {
    const updated = await userService.updateMe({
      firstName: updates.firstName,
      lastName: updates.lastName,
      businessName: updates.businessName,
      phone: updates.phone,
      trade: updates.trade,
      skills: updates.skills,
      accreditations: updates.accreditations,
      dayRate: updates.dayRate,
      dayRateVisible: updates.dayRateVisible,
      location: updates.location,
      travelRadius: updates.travelRadius,
      profileImageUrl: updates.profileImage ?? undefined,
      gallery: updates.gallery,
    });
    setCurrentUser(updated);
  }, []);

  const toggleJobInterest = useCallback(async (jobId: string) => {
    // Optimistic update
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? { ...j, isInterested: !j.isInterested, interestedCount: j.isInterested ? j.interestedCount - 1 : j.interestedCount + 1 }
        : j
    ));
    try {
      const updated = await jobService.toggleInterest(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
    } catch {
      // Roll back on error
      setJobs(prev => prev.map(j =>
        j.id === jobId
          ? { ...j, isInterested: !j.isInterested, interestedCount: j.isInterested ? j.interestedCount - 1 : j.interestedCount + 1 }
          : j
      ));
    }
  }, []);

  const addJob = useCallback(async (jobData: Omit<Job, 'id' | 'createdAt' | 'status' | 'interestedCount' | 'isInterested' | 'applicantCount'>) => {
    const newJob = await jobService.createJob({
      title: jobData.title,
      trade: jobData.trade,
      location: jobData.location,
      postcode: jobData.postcode,
      duration: jobData.duration,
      days: jobData.days,
      startDate: jobData.startDate,
      endDate: jobData.endDate,
      startTime: jobData.startTime,
      endTime: jobData.endTime,
      dayRate: jobData.dayRate,
      description: jobData.description,
      paymentTerms: jobData.paymentTerms,
      photos: jobData.photos,
    });
    setJobs(prev => [newJob, ...prev]);
    setMyJobs(prev => ({ ...prev, posted: [newJob, ...prev.posted] }));
  }, []);

  const acceptJob = useCallback(async (jobId: string, applicantId: string) => {
    const updated = await jobService.acceptApplicant(jobId, applicantId);
    setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
    setMyJobs(prev => ({
      ...prev,
      accepted: prev.accepted.some(j => j.id === jobId)
        ? prev.accepted.map(j => j.id === jobId ? updated : j)
        : [...prev.accepted, updated],
    }));
  }, []);

  const markJobComplete = useCallback(async (jobId: string) => {
    const updated = await jobService.completeJob(jobId);
    setMyJobs(prev => ({
      ...prev,
      accepted: prev.accepted.map(j => j.id === jobId ? updated : j),
      posted: prev.posted.map(j => j.id === jobId ? updated : j),
    }));
  }, []);

  const submitReview = useCallback(async (tradespersonId: string, review: { rating: number; text: string; jobId: string }) => {
    await reviewService.submitReview(tradespersonId, review);
  }, []);

  const startConversation = useCallback(async (participantId: string, relatedJobId?: string): Promise<string> => {
    const existing = conversations.find(c => c.participantId === participantId);
    if (existing) return existing.id;
    const conv = await conversationService.getOrCreate(participantId, relatedJobId);
    setConversations(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev]);
    return conv.id;
  }, [conversations]);

  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    const message = await conversationService.sendMessage(conversationId, text);
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, messages: [...conv.messages, message], lastMessage: text, lastMessageTime: message.timestamp }
        : conv
    ));
  }, []);

  const markConversationRead = useCallback(async (conversationId: string) => {
    await conversationService.markRead(conversationId);
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, unreadCount: 0, messages: conv.messages.map(m => ({ ...m, isRead: true })) }
        : conv
    ));
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    await notificationService.markRead(notificationId);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
  }, []);

  const updateSubscription = useCallback(async (tier: SubscriptionTier) => {
    await subscriptionService.update(tier);
    setCurrentUser(prev => prev ? { ...prev, subscription: tier } : prev);
  }, []);

  const loadTradespeople = useCallback(async (params?: { trade?: string; location?: string }) => {
    const data = await userService.getTradespeople(params);
    setTradespeople(data.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      businessName: u.businessName ?? '',
      trade: u.trade ?? '',
      skills: u.skills,
      accreditations: u.accreditations,
      dayRate: u.dayRate ?? 0,
      dayRateVisible: u.dayRateVisible,
      location: u.location ?? '',
      travelRadius: u.travelRadius,
      rating: u.rating,
      reviewCount: u.reviewCount,
      profileImage: u.profileImageUrl ?? null,
      gallery: u.gallery,
      reviews: [],
      phone: u.phone ?? '',
      email: u.email,
    })));
  }, []);

  const getUnreadNotificationCount = useCallback(() =>
    notifications.filter(n => !n.isRead).length, [notifications]);

  const getUnreadMessageCount = useCallback(() =>
    conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations]);

  const getJob = useCallback(
    (id: string) => [...jobs, ...myJobs.accepted, ...myJobs.posted].find(j => j.id === id),
    [jobs, myJobs]
  );

  const getConversation = useCallback(
    (id: string) => conversations.find(c => c.id === id),
    [conversations]
  );

  const fetchConversation = useCallback(async (id: string) => {
    const conv = await conversationService.getById(id);
    setConversations(prev => prev.map(c => c.id === id ? conv : c));
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser,
      isAuthenticated: !!firebaseUser,
      isLoading,
      tradespeople,
      jobs,
      myJobs,
      conversations,
      notifications,
      updateCurrentUser,
      toggleJobInterest,
      addJob,
      acceptJob,
      markJobComplete,
      submitReview,
      startConversation,
      sendMessage,
      markConversationRead,
      markNotificationRead,
      updateSubscription,
      loadTradespeople,
      getUnreadNotificationCount,
      getUnreadMessageCount,
      getJob,
      getConversation,
      fetchConversation,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContextProvider');
  return ctx;
}
