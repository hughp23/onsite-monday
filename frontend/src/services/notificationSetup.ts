import type { EventSubscription } from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { apiRequest } from './api';

// Expo Go on Android throws as soon as expo-notifications is imported (remote push was
// removed from Expo Go in SDK 53), so only load it in development and EAS builds.
const pushUnsupported =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Notifications: typeof import('expo-notifications') | null = pushUnsupported
  ? null
  : require('expo-notifications');

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerDeviceToken(): Promise<void> {
  if (!Notifications) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      console.warn('[Push] No EAS projectId found in app config — skipping device token registration');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await apiRequest('POST', '/devices/token', { token, platform });
  } catch (e) {
    console.warn('[Push] registerDeviceToken failed:', e);
  }
}

let responseSubscription: EventSubscription | null = null;
let receivedSubscription: EventSubscription | null = null;

export function setupNotificationHandlers(onNotificationReceived?: () => void): void {
  if (!Notifications) return;
  responseSubscription?.remove();
  receivedSubscription?.remove();

  // Fired when user taps a notification — navigate to the relevant screen
  responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data ?? {};
    const conversationId = data.conversationId as string | undefined;
    const type = data.type as string | undefined;
    const linkedId = data.linkedId as string | undefined;
    const role = data.role as string | undefined; // 'poster' | 'tradesperson'

    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    } else if ((type === 'job_completion_pending' || type === 'job_autocompleted') && linkedId) {
      if (role === 'tradesperson') {
        // job_completion_pending arrives before the job is completed, so it can't be reviewed yet
        router.push((type === 'job_completion_pending' ? `/job/${linkedId}` : `/review-poster/${linkedId}`) as any);
      } else {
        router.push(`/review/${linkedId}` as any);
      }
    }
  });

  // Fired when a notification arrives while the app is in the foreground
  receivedSubscription = Notifications.addNotificationReceivedListener(() => {
    onNotificationReceived?.();
  });
}

export function teardownNotificationHandlers(): void {
  responseSubscription?.remove();
  responseSubscription = null;
  receivedSubscription?.remove();
  receivedSubscription = null;
}
