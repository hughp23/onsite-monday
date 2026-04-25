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
    const conversationId = response.notification.request.content.data?.conversationId as string | undefined;
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
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
