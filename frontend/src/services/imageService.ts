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

  const asset = result.assets[0];
  const uri = asset.uri;

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

  const bucket = process.env.EXPO_PUBLIC_S3_BUCKET;
  if (!bucket) throw new Error('EXPO_PUBLIC_S3_BUCKET is not configured. Check your .env file and restart the bundler with --clear.');

  const { userId } = await getCurrentUser();
  const contentType = asset.mimeType ?? 'image/jpeg';
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const path = `profile-images/${userId}.${ext}`;

  // Pass bucket explicitly so Amplify does not fall back to a potentially
  // uninitialised global config (e.g. when Metro cache was built before .env was set).
  await uploadData({
    path,
    data: blob,
    options: { contentType, bucket: { bucketName: bucket, region: 'eu-west-2' } },
  }).result;

  // Bucket policy grants public read on profile-images/* — store as permanent URL.
  return `https://${bucket}.s3.eu-west-2.amazonaws.com/${path}`;
}
