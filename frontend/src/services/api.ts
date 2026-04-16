import { auth } from '@/lib/firebase';
import Constants from 'expo-constants';

// In dev, derive the host from Expo's dev server so the app works on
// simulators, Android emulators, and physical devices alike.
// Falls back to localhost for plain Node/Jest environments.
function devHost(): string {
  const uri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.42:8081"
  if (uri) return uri.split(':')[0];
  return 'localhost';
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${devHost()}:5236/api` : 'https://api.onsitemonday.co.uk/api');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown
): Promise<T> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, errorBody.error ?? 'Request failed');
  }

  // Handle 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}
