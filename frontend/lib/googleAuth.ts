import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
});

export async function signInWithGoogle() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    // Button is hidden in Expo Go — this throw is a safety net.
    throw new Error('Google sign-in is not available in Expo Go. Use the dev build.');
  }

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    throw new Error('cancelled');
  }

  const { idToken } = response.data;
  if (!idToken) {
    throw new Error('Google sign-in succeeded but returned no ID token.');
  }
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}
