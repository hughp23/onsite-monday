import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { User, Job, Tradesperson, Conversation, AppNotification, Review, SubscriptionTier } from '@/constants/types';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/src/services/userService';
import { jobService } from '@/src/services/jobService';
import { conversationService } from '@/src/services/conversationService';
import { notificationService } from '@/src/services/notificationService';
import { subscriptionService } from '@/src/services/subscriptionService';
import { reviewService } from '@/src/services/reviewService';
import { signalRService } from '@/src/services/signalRService';

interface AppContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tradespeople: Tradesperson[];
  jobs: Job[];
  myJobs: { liked: Job[]; applied: Job[]; accepted: Job[]; posted: Job[] };
  conversations: Conversation[];
  notifications: AppNotification[];
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  toggleJobInterest: (jobId: string) => Promise<void>;
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'status' | 'interestedCount' | 'isInterested' | 'applicantCount'>) => Promise<void>;
  acceptJob: (jobId: string, applicantId: string) => Promise<void>;
  startJob: (jobId: string) => Promise<void>;
  markJobComplete: (jobId: string) => Promise<void>;
  applyToJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string, reason?: string) => Promise<void>;
  submitReview: (tradespersonId: string, review: { rating: number; text: string; jobId: string }) => Promise<void>;
  submitTradesPersonReview: (jobId: string, review: { rating: number; text?: string }) => Promise<void>;
  startConversation: (participantId: string, relatedJobId?: string) => Promise<string>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateSubscription: (tier: SubscriptionTier, updateCardAndUpgrade?: boolean) => Promise<{ checkoutUrl: string | null }>;
  loadTradespeople: (params?: { trade?: string; location?: string }) => Promise<void>;
  refreshJobs: () => Promise<void>;
  refreshMyJobs: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  getUnreadNotificationCount: () => number;
  getUnreadMessageCount: () => number;
  getJob: (id: string) => Job | undefined;
  getConversation: (id: string) => Conversation | undefined;
  fetchConversation: (id: string) => Promise<void>;
  addIncomingMessage: (message: import('@/constants/types').Message) => void;
  refreshAppData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const { cognitoUser } = useAuth();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshAppData = useCallback(() => setRefreshKey(k => k + 1), []);
  const [tradespeople, setTradespeople] = useState<Tradesperson[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<{ liked: Job[]; applied: Job[]; accepted: Job[]; posted: Job[] }>({ liked: [], applied: [], accepted: [], posted: [] });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load all app data when Cognito user becomes available
  useEffect(() => {
    if (!cognitoUser) {
      setCurrentUser(null);
      setJobs([]);
      setMyJobs({ liked: [], applied: [], accepted: [], posted: [] });
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

        // Fetch user first — ensures the DB row exists before parallel calls fire
        const user = await call('getMe', () => userService.getMe());

        const [jobList, likedJobs, appliedJobs, acceptedJobs, postedJobs, convs, notifs] = await Promise.all([
          call('getJobs', () => jobService.getJobs()),
          jobService.getMyLikedJobs().catch(() => [] as Job[]),
          jobService.getMyAppliedJobs().catch(() => [] as Job[]),
          call('getMyAcceptedJobs', () => jobService.getMyAcceptedJobs()),
          call('getMyPostedJobs', () => jobService.getMyPostedJobs()),
          call('getConversations', () => conversationService.getConversations()),
          call('getNotifications', () => notificationService.getNotifications()),
        ]);
        setCurrentUser(user);
        setJobs(jobList);
        setMyJobs({ liked: likedJobs, applied: appliedJobs, accepted: acceptedJobs, posted: postedJobs });
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
  }, [cognitoUser, refreshKey]);

  const addIncomingMessage = useCallback((message: import('@/constants/types').Message) => {
    setConversations(prev => prev.map(conv =>
      conv.id === message.conversationId
        ? {
            ...conv,
            messages: conv.messages.some(m => m.id === message.id)
              ? conv.messages
              : [...conv.messages, message],
            lastMessage: message.text,
            lastMessageTime: message.timestamp,
            unreadCount: conv.unreadCount + 1,
          }
        : conv
    ));
  }, []);

  // Track which conversation IDs have been joined so we only join new ones
  const joinedConvIds = useRef(new Set<string>());

  useEffect(() => {
    if (!cognitoUser) {
      joinedConvIds.current.clear();
      return;
    }

    // Register global handler — updates conversations list from any screen
    const cleanup = signalRService.onReceiveMessage(addIncomingMessage);
    signalRService.start().catch(() => {});

    return () => {
      cleanup();
      signalRService.stop().catch(() => {});
    };
  }, [cognitoUser, addIncomingMessage]);

  useEffect(() => {
    if (!cognitoUser || conversations.length === 0) return;
    conversations.forEach(c => {
      if (!joinedConvIds.current.has(c.id)) {
        joinedConvIds.current.add(c.id);
        signalRService.joinConversation(c.id).catch(() => {});
      }
    });
  }, [cognitoUser, conversations]);

  const updateCurrentUser = useCallback(async (updates: Partial<User>) => {
    // Treat empty strings as undefined so they are omitted from the JSON body
    // and don't trigger backend NotEmpty() validation.
    const str = (v: string | undefined): string | undefined =>
      v !== undefined && v !== '' ? v : undefined;

    const updated = await userService.updateMe({
      firstName: str(updates.firstName),
      lastName: str(updates.lastName),
      businessName: str(updates.businessName),
      phone: str(updates.phone),
      trade: str(updates.trade),
      skills: updates.skills,
      accreditations: updates.accreditations,
      dayRate: updates.dayRate,
      dayRateVisible: updates.dayRateVisible,
      location: str(updates.location),
      travelRadius: updates.travelRadius,
      profileImageUrl: updates.profileImage ?? undefined,
      gallery: updates.gallery,
    });
    setCurrentUser(updated);
  }, []);

  const completeOnboarding = useCallback(async () => {
    const user = await userService.completeOnboarding();
    setCurrentUser(user);
  }, []);

  const toggleJobInterest = useCallback(async (jobId: string) => {
    // Optimistic update across every array so getJob() always sees the change
    const flipInterest = (j: Job): Job =>
      j.id === jobId
        ? { ...j, isInterested: !j.isInterested, interestedCount: j.isInterested ? j.interestedCount - 1 : j.interestedCount + 1 }
        : j;

    setJobs(prev => prev.map(flipInterest));
    setMyJobs(prev => ({
      ...prev,
      liked: (prev.liked ?? []).map(flipInterest),
      applied: (prev.applied ?? []).map(flipInterest),
      accepted: (prev.accepted ?? []).map(flipInterest),
      posted: (prev.posted ?? []).map(flipInterest),
    }));

    try {
      const updated = await jobService.toggleInterest(jobId);
      // Settle with server values
      setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
      setMyJobs(prev => {
        const liked = prev.liked ?? [];
        const applied = prev.applied ?? [];
        const settled = (arr: Job[]) => arr.map(j => j.id === jobId ? updated : j);
        if (updated.isInterested) {
          return {
            ...prev,
            liked: liked.some(j => j.id === jobId) ? settled(liked) : [updated, ...liked],
            applied: settled(applied),
            accepted: settled(prev.accepted ?? []),
            posted: settled(prev.posted ?? []),
          };
        } else {
          return {
            ...prev,
            liked: liked.filter(j => j.id !== jobId),
            applied: applied.filter(j => j.id !== jobId),
            accepted: settled(prev.accepted ?? []),
            posted: settled(prev.posted ?? []),
          };
        }
      });
    } catch {
      // Roll back all arrays
      setJobs(prev => prev.map(flipInterest));
      setMyJobs(prev => ({
        ...prev,
        liked: (prev.liked ?? []).map(flipInterest),
        applied: (prev.applied ?? []).map(flipInterest),
        accepted: (prev.accepted ?? []).map(flipInterest),
        posted: (prev.posted ?? []).map(flipInterest),
      }));
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

  const applyToJob = useCallback(async (jobId: string) => {
    const updated = await jobService.applyToJob(jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
    setMyJobs(prev => {
      const liked = prev.liked ?? [];
      const applied = prev.applied ?? [];
      return {
        ...prev,
        liked: liked.filter(j => j.id !== jobId),
        applied: applied.some(j => j.id === jobId)
          ? applied.map(j => j.id === jobId ? updated : j)
          : [updated, ...applied],
      };
    });
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

  const startJob = useCallback(async (jobId: string) => {
    const { job: updated, payInRedirectUrl } = await jobService.startJob(jobId);
    setMyJobs(prev => ({
      ...prev,
      posted: prev.posted.map(j => j.id === jobId ? updated : j),
    }));
    if (payInRedirectUrl) {
      const { Linking } = await import('react-native');
      await Linking.openURL(payInRedirectUrl);
    }
  }, []);

  const markJobComplete = useCallback(async (jobId: string) => {
    const updated = await jobService.completeJob(jobId);
    setMyJobs(prev => ({
      ...prev,
      accepted: prev.accepted.map(j => j.id === jobId ? updated : j),
      posted: prev.posted.map(j => j.id === jobId ? updated : j),
    }));
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    await jobService.deleteJob(jobId);
    setMyJobs(prev => ({ ...prev, posted: prev.posted.filter(j => j.id !== jobId) }));
    setJobs(prev => prev.filter(j => j.id !== jobId));
  }, []);

  const cancelJob = useCallback(async (jobId: string, reason?: string) => {
    const updated = await jobService.cancelJob(jobId, reason);
    setMyJobs(prev => ({
      ...prev,
      accepted: prev.accepted.map(j => j.id === jobId ? updated : j),
      posted: prev.posted.map(j => j.id === jobId ? updated : j),
    }));
  }, []);

  const submitReview = useCallback(async (tradespersonId: string, review: { rating: number; text: string; jobId: string }) => {
    await reviewService.submitReview(tradespersonId, review);
  }, []);

  const submitTradesPersonReview = useCallback(async (jobId: string, review: { rating: number; text?: string }) => {
    await reviewService.submitTradesPersonReview(jobId, review);
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

  const updateSubscription = useCallback(async (tier: SubscriptionTier, updateCardAndUpgrade = false) => {
    const { subscription, checkoutUrl } = await subscriptionService.update(tier, updateCardAndUpgrade);
    setCurrentUser(prev => prev ? { ...prev, subscription: subscription.tier as SubscriptionTier } : prev);
    if (checkoutUrl) {
      const { Linking } = await import('react-native');
      await Linking.openURL(checkoutUrl);
    }
    return { checkoutUrl };
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

  const refreshJobs = useCallback(async () => {
    const jobList = await jobService.getJobs();
    setJobs(jobList);
  }, []);

  const refreshMyJobs = useCallback(async () => {
    const [liked, applied, accepted, posted] = await Promise.all([
      jobService.getMyLikedJobs().catch(() => [] as Job[]),
      jobService.getMyAppliedJobs().catch(() => [] as Job[]),
      jobService.getMyAcceptedJobs(),
      jobService.getMyPostedJobs(),
    ]);
    setMyJobs({ liked, applied, accepted, posted });
  }, []);

  const refreshConversations = useCallback(async () => {
    const convs = await conversationService.getConversations();
    setConversations(convs);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const notifs = await notificationService.getNotifications();
    setNotifications(notifs);
  }, []);

  const getUnreadNotificationCount = useCallback(() =>
    notifications.filter(n => !n.isRead).length, [notifications]);

  const getUnreadMessageCount = useCallback(() =>
    conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations]);

  const getJob = useCallback(
    (id: string) => [...jobs, ...myJobs.liked, ...myJobs.applied, ...myJobs.accepted, ...myJobs.posted].find(j => j.id === id),
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
      isAuthenticated: !!cognitoUser,
      isLoading,
      tradespeople,
      jobs,
      myJobs,
      conversations,
      notifications,
      updateCurrentUser,
      completeOnboarding,
      toggleJobInterest,
      addJob,
      applyToJob,
      acceptJob,
      startJob,
      markJobComplete,
      deleteJob,
      cancelJob,
      submitReview,
      submitTradesPersonReview,
      startConversation,
      sendMessage,
      markConversationRead,
      markNotificationRead,
      updateSubscription,
      loadTradespeople,
      refreshJobs,
      refreshMyJobs,
      refreshConversations,
      refreshNotifications,
      getUnreadNotificationCount,
      getUnreadMessageCount,
      getJob,
      getConversation,
      fetchConversation,
      addIncomingMessage,
      refreshAppData,
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
