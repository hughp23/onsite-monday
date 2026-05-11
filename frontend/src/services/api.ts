import { fetchAuthSession } from 'aws-amplify/auth';
import Constants from 'expo-constants';

function devHost(): string {
  const uri = Constants.expoConfig?.hostUri;
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
  let token: string | null = null;
  try {
    const session = await fetchAuthSession();
    token = session.tokens?.idToken?.toString() ?? null;
  } catch {
    // Not authenticated — proceed without token
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message: string =
      errorBody.error ??
      (errorBody.errors
        ? Object.values(errorBody.errors as Record<string, string[]>)
            .flat()
            .join('; ')
        : null) ??
      errorBody.title ??
      'Request failed';
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}
