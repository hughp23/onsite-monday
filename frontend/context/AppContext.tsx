import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { User, Job, Tradesperson, Conversation, AppNotification, Review, SubscriptionTier } from '@/constants/types';
import { useAuth } from '@/context/AuthContext';
import { userService, ApiUser } from '@/src/services/userService';
import { jobService } from '@/src/services/jobService';
import { conversationService } from '@/src/services/conversationService';
import { notificationService } from '@/src/services/notificationService';
import { subscriptionService, SubscriptionDto } from '@/src/services/subscriptionService';
import { reviewService } from '@/src/services/reviewService';
import { signalRService } from '@/src/services/signalRService';
import { usageService } from '@/src/services/usageService';
import { Usage } from '@/src/utils/tierUsage';
import { PAGE_SIZE, mergePage } from '@/src/utils/pagination';

function toTradesperson(u: ApiUser): Tradesperson {
  return {
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
    bio: u.bio ?? '',
    email: u.email,
  };
}

interface AppContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tradespeople: Tradesperson[];
  jobs: Job[];
  myJobs: { liked: Job[]; applied: Job[]; accepted: Job[]; posted: Job[] };
  conversations: Conversation[];
  notifications: AppNotification[];
  usage: Usage | null;
  refreshUsage: () => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  toggleJobInterest: (jobId: string) => Promise<void>;
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'status' | 'interestedCount' | 'isInterested' | 'applicantCount'>) => Promise<void>;
  acceptJob: (jobId: string, applicantId: string) => Promise<void>;
  startJob: (jobId: string) => Promise<void>;
  markJobComplete: (jobId: string) => Promise<void>;
  applyToJob: (jobId: string, coverNote?: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string, reason?: string) => Promise<void>;
  submitReview: (tradespersonId: string, review: { rating: number; text: string; jobId: string }) => Promise<void>;
  submitTradesPersonReview: (jobId: string, review: { rating: number; text?: string }) => Promise<void>;
  startConversation: (participantId: string, relatedJobId?: string) => Promise<string>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateSubscription: (tier: SubscriptionTier, updateCardAndUpgrade?: boolean) => Promise<{ checkoutUrl: string | null }>;
  cancelSubscription: () => Promise<SubscriptionDto>;
  loadTradespeople: (params?: { trade?: string; location?: string }) => Promise<void>;
  hasMoreTradespeople: boolean;
  loadMoreTradespeople: () => Promise<void>;
  loadMoreTradespeopleError: string | null;
  refreshJobs: () => Promise<void>;
  hasMoreJobs: boolean;
  loadMoreJobs: () => Promise<void>;
  loadMoreJobsError: string | null;
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
  const [peopleParams, setPeopleParams] = useState<{ trade?: string; location?: string }>({});
  const [peoplePage, setPeoplePage] = useState(1);
  const [hasMoreTradespeople, setHasMoreTradespeople] = useState(true);
  const [loadMoreTradespeopleError, setLoadMoreTradespeopleError] = useState<string | null>(null);
  const loadingMoreTradespeople = useRef(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);
  const [loadMoreJobsError, setLoadMoreJobsError] = useState<string | null>(null);
  const loadingMoreJobs = useRef(false);
  // Bumped on every list reset so an in-flight load-more can tell its result is stale.
  const jobsGeneration = useRef(0);
  const peopleGeneration = useRef(0);
  const [myJobs, setMyJobs] = useState<{ liked: Job[]; applied: Job[]; accepted: Job[]; posted: Job[] }>({ liked: [], applied: [], accepted: [], posted: [] });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await usageService.get()); } catch { /* banner just stays hidden */ }
  }, []);

  // Load all app data when Cognito user becomes available
  useEffect(() => {
    if (!cognitoUser) {
      setCurrentUser(null);
      jobsGeneration.current++;
      loadingMoreJobs.current = false;
      setJobs([]);
      setMyJobs({ liked: [], applied: [], accepted: [], posted: [] });
      setConversations([]);
      setNotifications([]);
      setUsage(null);
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
        jobsGeneration.current++;
        loadingMoreJobs.current = false;
        const user = await call('getMe', () => userService.getMe());

        const [jobList, likedJobs, appliedJobs, acceptedJobs, postedJobs, convs, notifs] = await Promise.all([
          call('getJobs', () => jobService.getJobs({ page: 1, pageSize: PAGE_SIZE })),
          jobService.getMyLikedJobs().catch(() => [] as Job[]),
          jobService.getMyAppliedJobs().catch(() => [] as Job[]),
          call('getMyAcceptedJobs', () => jobService.getMyAcceptedJobs()),
          call('getMyPostedJobs', () => jobService.getMyPostedJobs()),
          call('getConversations', () => conversationService.getConversations()),
          call('getNotifications', () => notificationService.getNotifications()),
        ]);
        setCurrentUser(user);
        jobsGeneration.current++;
        loadingMoreJobs.current = false;
        setJobs(jobList);
        setJobsPage(1);
        setHasMoreJobs(jobList.length === PAGE_SIZE);
        setMyJobs({ liked: likedJobs, applied: appliedJobs, accepted: acceptedJobs, posted: postedJobs });
        setConversations(convs);
        setNotifications(notifs);
        await refreshUsage();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('loadAppData failed:', msg);
        Alert.alert('Load failed', msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppData();
  }, [cognitoUser, refreshKey, refreshUsage]);

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
      // Sent as-is (not via str) so an emptied business name is cleared on the server
      businessName: updates.businessName,
      phone: str(updates.phone),
      // Sent as-is (not via str) so an emptied bio is cleared on the server
      bio: updates.bio,
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
    await refreshUsage();
  }, [refreshUsage]);

  const applyToJob = useCallback(async (jobId: string, coverNote?: string) => {
    const updated = await jobService.applyToJob(jobId, coverNote);
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
    await refreshUsage();
  }, [refreshUsage]);

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
    await refreshUsage();
    return { checkoutUrl };
  }, [refreshUsage]);

  const cancelSubscription = useCallback(async () => {
    const sub = await subscriptionService.cancel();
    setCurrentUser(prev => prev ? { ...prev, subscription: sub.tier as SubscriptionTier } : prev);
    return sub;
  }, []);

  const loadTradespeople = useCallback(async (params: { trade?: string; location?: string } = {}) => {
    // Invalidate any in-flight load-more before and after the fetch (see loadMoreTradespeople).
    peopleGeneration.current++;
    loadingMoreTradespeople.current = false;
    const data = await userService.getTradespeople({ ...params, page: 1, pageSize: PAGE_SIZE });
    peopleGeneration.current++;
    loadingMoreTradespeople.current = false;
    setTradespeople(data.map(toTradesperson));
    setPeopleParams(params);
    setPeoplePage(1);
    setHasMoreTradespeople(data.length === PAGE_SIZE);
    setLoadMoreTradespeopleError(null);
  }, []);

  const loadMoreTradespeople = useCallback(async () => {
    if (!hasMoreTradespeople || loadingMoreTradespeople.current) return;
    loadingMoreTradespeople.current = true;
    const generation = peopleGeneration.current;
    setLoadMoreTradespeopleError(null);
    try {
      const next = peoplePage + 1;
      const incoming = await userService.getTradespeople({ ...peopleParams, page: next, pageSize: PAGE_SIZE });
      if (generation !== peopleGeneration.current) return; // a reset happened; discard
      const mapped = incoming.map(toTradesperson);
      // Merge against the latest list (pure updater); dedupes by id.
      setTradespeople(prev => mergePage(prev, mapped, PAGE_SIZE).items);
      setPeoplePage(next);
      setHasMoreTradespeople(incoming.length === PAGE_SIZE);
    } catch (e) {
      if (generation !== peopleGeneration.current) return; // stale error must not surface
      setLoadMoreTradespeopleError(e instanceof Error ? e.message : 'Failed to load more tradespeople');
    } finally {
      if (generation === peopleGeneration.current) loadingMoreTradespeople.current = false;
    }
  }, [hasMoreTradespeople, peoplePage, peopleParams]);

  const refreshJobs = useCallback(async () => {
    jobsGeneration.current++;
    loadingMoreJobs.current = false;
    const first = await jobService.getJobs({ page: 1, pageSize: PAGE_SIZE });
    jobsGeneration.current++;
    loadingMoreJobs.current = false;
    setJobs(first);
    setJobsPage(1);
    setHasMoreJobs(first.length === PAGE_SIZE);
    setLoadMoreJobsError(null);
  }, []);

  const loadMoreJobs = useCallback(async () => {
    if (!hasMoreJobs || loadingMoreJobs.current) return;
    loadingMoreJobs.current = true;
    const generation = jobsGeneration.current;
    setLoadMoreJobsError(null);
    try {
      const next = jobsPage + 1;
      const incoming = await jobService.getJobs({ page: next, pageSize: PAGE_SIZE });
      if (generation !== jobsGeneration.current) return; // a refresh happened; discard
      // Merge against the latest list (pure updater); dedupes by id.
      setJobs(prev => mergePage(prev, incoming, PAGE_SIZE).items);
      setJobsPage(next);
      setHasMoreJobs(incoming.length === PAGE_SIZE);
    } catch (e) {
      if (generation !== jobsGeneration.current) return; // stale error must not surface
      setLoadMoreJobsError(e instanceof Error ? e.message : 'Failed to load more jobs');
    } finally {
      if (generation === jobsGeneration.current) loadingMoreJobs.current = false;
    }
  }, [hasMoreJobs, jobsPage]);

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
      usage,
      refreshUsage,
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
      cancelSubscription,
      loadTradespeople,
      hasMoreTradespeople,
      loadMoreTradespeople,
      loadMoreTradespeopleError,
      refreshJobs,
      hasMoreJobs,
      loadMoreJobs,
      loadMoreJobsError,
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
