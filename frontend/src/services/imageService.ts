import * as ImagePicker from 'expo-image-picker';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';

export const CANCELLED = 'cancelled' as const;

export async function uploadProfileImage(
  source: 'library' | 'camera'
): Promise<string | typeof CANCELLED> {
  // 1. Request the correct permission for the chosen source
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error(
        'Camera access was denied. Please enable it in your device Settings to take a profile photo.'
      );
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error(
        'Photo library access was denied. Please enable it in your device Settings to upload a profile photo.'
      );
    }
  }

  // 2. Open picker or camera with square crop enforced
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled) return CANCELLED;

  const uri = result.assets[0].uri;

  // 3. Convert local file URI → Blob
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

  // 4. Upload to S3 via Amplify Storage (overwrites previous photo for this user)
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');

  const key = `profile-images/${user.userId}.jpg`;
  await uploadData({ key, data: blob, options: { contentType: 'image/jpeg' } }).result;

  // 5. Return permanent public URL — bucket policy grants public read on profile-images/*
  const bucket = process.env.EXPO_PUBLIC_S3_BUCKET!;
  return `https://${bucket}.s3.eu-west-2.amazonaws.com/${key}`;
}
