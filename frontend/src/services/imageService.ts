import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

/** Sentinel returned when the user dismisses the picker without selecting. */
export const CANCELLED = 'cancelled' as const;

/**
 * Prompts the user to pick a photo from their library, uploads it to
 * Firebase Storage, and returns the public download URL.
 *
 * Returns `CANCELLED` if the user dismissed the picker.
 * Throws on permission denial or upload failure.
 */
export async function pickAndUploadProfileImage(): Promise<string | typeof CANCELLED> {
  // 1. Request media library permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Photo library access was denied. Please enable it in your device Settings to upload a profile photo.'
    );
  }

  // 2. Open the image picker with square crop enforced
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return CANCELLED;

  const uri = result.assets[0].uri;

  // 3. Convert local file URI → Blob
  const response = await fetch(uri);
  const blob = await response.blob();

  // 4. Upload to Firebase Storage (overwrites previous photo)
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');

  const storageRef = ref(storage, `profile-images/${uid}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });

  // 5. Return the permanent download URL
  return getDownloadURL(storageRef);
}
