import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from './api';

export const CANCELLED = 'cancelled' as const;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

export async function uploadProfileImage(
  source: 'library' | 'camera'
): Promise<string | typeof CANCELLED> {
  let result: ImagePicker.ImagePickerResult;

  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error(
        'Camera access was denied. Please enable it in your device Settings to take a profile photo.'
      );
    }
    result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error(
        'Photo library access was denied. Please enable it in your device Settings to upload a profile photo.'
      );
    }
    result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  }

  if (result.canceled) return CANCELLED;

  const asset = result.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';

  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError('Failed to read image file.'));
    xhr.responseType = 'blob';
    xhr.open('GET', asset.uri, true);
    xhr.send(null);
  });

  const { uploadUrl, publicUrl } = await apiRequest<UploadUrlResponse>(
    'POST',
    '/users/me/profile-image-upload-url',
    { contentType }
  );

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Image upload failed (${uploadResponse.status}). Please try again.`);
  }

  return publicUrl;
}
