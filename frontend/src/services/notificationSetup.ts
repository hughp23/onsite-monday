import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { apiRequest } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerDeviceToken(): Promise<void> {
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

let responseSubscription: Notifications.EventSubscription | null = null;
let receivedSubscription: Notifications.EventSubscription | null = null;

export function setupNotificationHandlers(onNotificationReceived?: () => void): void {
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
        router.push(`/review-poster/${linkedId}` as any);
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
