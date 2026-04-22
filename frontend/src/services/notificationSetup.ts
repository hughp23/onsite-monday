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
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await apiRequest('POST', '/devices/token', { token, platform });
  } catch {
    // Non-fatal — app works without push notifications
  }
}

let notificationSubscription: Notifications.EventSubscription | null = null;

export function setupNotificationHandlers(): void {
  notificationSubscription?.remove();
  notificationSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const conversationId = response.notification.request.content.data?.conversationId as string | undefined;
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    }
  });
}

export function teardownNotificationHandlers(): void {
  notificationSubscription?.remove();
  notificationSubscription = null;
}
