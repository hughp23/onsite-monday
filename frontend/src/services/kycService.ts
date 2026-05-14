import { fetchAuthSession } from 'aws-amplify/auth';
import Constants from 'expo-constants';
import { ApiError } from './api';

function devHost(): string {
  const uri = Constants.expoConfig?.hostUri;
  if (uri) return uri.split(':')[0];
  return 'localhost';
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${devHost()}:5236/api` : 'https://api.onsitemonday.co.uk/api');

export const kycService = {
  /**
   * Upload a KYC identity document.
   * @param fileUri - Local file URI from expo-image-picker (e.g. file:///path/to/image.jpg)
   */
  submitKycDocument: async (fileUri: string): Promise<void> => {
    let token: string | null = null;
    try {
      const session = await fetchAuthSession();
      token = session.tokens?.idToken?.toString() ?? null;
    } catch {
      // Not authenticated — proceed without token
    }

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'image/jpeg',
      name: 'document.jpg',
    } as any);

    const response = await fetch(`${BASE_URL}/kyc/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
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
        'KYC document upload failed';
      throw new ApiError(response.status, message);
    }
  },
};
