import * as ImagePicker from 'expo-image-picker';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';

export const CANCELLED = 'cancelled' as const;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

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

  const uri = result.assets[0].uri;

  // fetch().blob() is unreliable in React Native with the AWS SDK.
  // XMLHttpRequest is the correct approach here.
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError('Failed to read image file.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');

  const key = `profile-images/${user.userId}.jpg`;
  await uploadData({ key, data: blob, options: { contentType: 'image/jpeg' } }).result;

  // Bucket policy grants public read on profile-images/* — store as permanent URL.
  const bucket = process.env.EXPO_PUBLIC_S3_BUCKET;
  if (!bucket) throw new Error('EXPO_PUBLIC_S3_BUCKET is not set.');
  return `https://${bucket}.s3.eu-west-2.amazonaws.com/${key}`;
}
