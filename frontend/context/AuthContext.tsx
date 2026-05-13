import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentUser,
  signIn,
  signUp,
  confirmSignUp,
  signOut as amplifySignOut,
  signInWithRedirect,
  resetPassword,
  confirmResetPassword,
  type AuthUser,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthContextType {
  cognitoUser: AuthUser | null;
  isAuthLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<{ needsConfirmation: boolean }>;
  confirmSignUpCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function rethrowUnlessAlreadyAuthenticated(err: unknown): void {
  if (err instanceof Error && err.name === 'UserAlreadyAuthenticatedException') return;
  throw err;
}

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [cognitoUser, setCognitoUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(user => setCognitoUser(user))
      .catch(() => setCognitoUser(null))
      .finally(() => setIsAuthLoading(false));

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          setCognitoUser(payload.data as AuthUser);
          break;
        case 'signedOut':
          setCognitoUser(null);
          break;
        case 'tokenRefresh':
          getCurrentUser()
            .then(user => setCognitoUser(user))
            .catch(() => setCognitoUser(null));
          break;
        case 'signInWithRedirect_failure':
          console.error('Hosted UI sign-in failed:', payload.data);
          break;
      }
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password, options: { authFlowType: 'USER_PASSWORD_AUTH' } });
      if (!isSignedIn && nextStep.signInStep !== 'DONE') {
        throw new Error(`Unexpected sign-in step: ${nextStep.signInStep}`);
      }
    } catch (err: unknown) {
      rethrowUnlessAlreadyAuthenticated(err);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<{ needsConfirmation: boolean }> => {
    const { isSignUpComplete, nextStep } = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          given_name: firstName,
          family_name: lastName,
        },
      },
    });
    return { needsConfirmation: !isSignUpComplete && nextStep.signUpStep === 'CONFIRM_SIGN_UP' };
  };

  const confirmSignUpCode = async (email: string, code: string) => {
    await confirmSignUp({ username: email, confirmationCode: code });
  };

  const signOut = async () => {
    await amplifySignOut();
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (err: unknown) {
      rethrowUnlessAlreadyAuthenticated(err);
    }
  };

  const requestPasswordReset = async (email: string): Promise<void> => {
    await resetPassword({ username: email });
  };

  const confirmPasswordReset = async (email: string, code: string, newPassword: string): Promise<void> => {
    await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
  };

  return (
    <AuthContext.Provider
      value={{
        cognitoUser,
        isAuthLoading,
        signInWithEmail,
        signUpWithEmail,
        confirmSignUpCode,
        signOut,
        signInWithGoogle,
        requestPasswordReset,
        confirmPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthContextProvider');
  return ctx;
}
