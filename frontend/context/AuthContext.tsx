import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Lazy import: @react-native-google-signin calls TurboModuleRegistry.getEnforcing at
// module evaluation time, which crashes Expo Go. require() defers it to call time.
const getGoogleSignIn = (): (() => Promise<UserCredential>) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/lib/googleAuth') as { signInWithGoogle: () => Promise<UserCredential> }).signInWithGoogle;

// Lazy import: same pattern for expo-apple-authentication.
const getAppleSignIn = (): (() => Promise<UserCredential>) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/lib/appleAuth') as { signInWithApple: () => Promise<UserCredential> }).signInWithApple;

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  isAuthLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<UserCredential>;
  signInWithApple: () => Promise<UserCredential>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Also clear the native Google session so the account picker shows next time.
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as
        typeof import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // Not available in Expo Go or if never signed in via Google — safe to ignore.
    }
  };

  const signInWithGoogle = (): Promise<UserCredential> => {
    return getGoogleSignIn()();
  };

  const signInWithApple = (): Promise<UserCredential> => {
    return getAppleSignIn()();
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, isAuthLoading, signInWithEmail, signUpWithEmail, signOut, signInWithGoogle, signInWithApple }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthContextProvider');
  return ctx;
}
