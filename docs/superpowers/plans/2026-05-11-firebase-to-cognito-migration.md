# Firebase to AWS Cognito Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase Authentication with AWS Cognito User Pools across the full stack (Expo React Native frontend + .NET 8 backend), with social sign-in (Google/Apple) handled via Cognito Hosted UI.

**Architecture:** Cognito User Pool manages email/password accounts and federates Google and Apple OAuth through Cognito Hosted UI (browser-based redirect). The frontend replaces the `firebase` SDK with `aws-amplify` v6 + `@aws-amplify/react-native`; `fetchAuthSession()` replaces `auth.currentUser.getIdToken()` wherever tokens are obtained. The backend swaps its JWT issuer/audience config from Firebase's `securetoken.google.com` authority to Cognito's JWKS endpoint and renames the `FirebaseUid` database column to `CognitoSub` via an EF Core migration. Pre-launch codebase — no user data migration required.

**Tech Stack:** `aws-amplify` v6, `@aws-amplify/react-native`, Cognito User Pool (email/password + Google/Apple federation), Cognito Hosted UI, `Microsoft.AspNetCore.Authentication.JwtBearer` (Cognito JWKS), Entity Framework Core migration (PostgreSQL).

---

## AWS Console Prerequisites (complete before coding)

Before running any task, verify the following are configured in the AWS Console:

1. **Cognito User Pool** — created with email sign-in enabled.
2. **App Client** — public client (no secret), with:
   - Allowed callback URLs: `onsite-monday://`
   - Allowed sign-out URLs: `onsite-monday://`
   - OAuth 2.0 grant: Authorization Code
   - Scopes: `email`, `openid`, `profile`
3. **Cognito Domain** — a domain like `your-app.auth.eu-west-2.amazoncognito.com` configured under "App integration → Domain".
4. **Google identity provider** — added under "Sign-in experience → Federated identity provider sign-in" with Google OAuth client credentials.
5. **Apple identity provider** — added with Apple OAuth credentials.
6. Note down: `User Pool ID`, `App Client ID`, `Cognito domain`, `AWS Region`.

---

## Files Changed

### Frontend (`/frontend`)

| Action | Path |
|--------|------|
| Create | `lib/amplify.ts` |
| Delete | `lib/firebase.ts` |
| Delete | `lib/googleAuth.ts` |
| Delete | `lib/appleAuth.ts` |
| Modify | `context/AuthContext.tsx` |
| Modify | `context/AppContext.tsx` (line 53, 65, 109) |
| Modify | `src/services/api.ts` |
| Modify | `src/services/signalRService.ts` |
| Modify | `app/sign-in.tsx` (social button handlers) |
| Modify | `app/sign-up.tsx` (add confirmation code step) |
| Modify | `app.json` (remove Google/Apple plugins) |
| Modify | `.env` / EAS env vars |

### Backend (`/backend/src/OnsiteMonday.Api`)

| Action | Path |
|--------|------|
| Modify | `Program.cs` (JWT authority) |
| Modify | `appsettings.json` |
| Modify | `Domain/User.cs` |
| Modify | `Repositories/Interfaces/IUserRepository.cs` |
| Modify | `Repositories/UserRepository.cs` |
| Modify | `Services/UserService.cs` |
| Modify | `Controllers/UsersController.cs` |
| Modify | `Controllers/JobsController.cs` |
| Modify | `Controllers/ConversationsController.cs` |
| Modify | `Controllers/ReviewsController.cs` |
| Modify | `Controllers/NotificationsController.cs` |
| Modify | `Controllers/SubscriptionsController.cs` |
| Modify | `Controllers/DevicesController.cs` |
| Modify | `Data/DataSeeder.cs` |
| Create | EF Core migration (rename column) |

---

## Task 1: Install Amplify, remove Firebase/social SDK packages

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/app.json`

- [ ] **Step 1: Remove Firebase and native social sign-in packages**

```bash
cd frontend
npm remove firebase @react-native-google-signin/google-signin expo-apple-authentication expo-crypto
```

Expected: packages removed, no errors about missing peer deps.

- [ ] **Step 2: Install Amplify v6 for React Native**

```bash
npm install aws-amplify @aws-amplify/react-native
```

Expected: packages installed successfully.

- [ ] **Step 3: Remove Google Sign-In and Apple auth plugins from `app.json`**

Open `frontend/app.json`. Remove these two entries from the `plugins` array:

```json
[
  "@react-native-google-signin/google-signin",
  {
    "iosUrlScheme": "com.googleusercontent.apps.838911528327-ninil92kp7cv5v579o2kacleam90c4n7"
  }
],
"expo-apple-authentication"
```

The `plugins` array should contain only:
```json
"plugins": [
  "expo-router",
  "expo-image-picker",
  [
    "expo-notifications",
    {
      "icon": "./assets/icon.png",
      "color": "#8B2020"
    }
  ],
  "@react-native-community/datetimepicker"
]
```

> **Note:** Keep `google-services.json` and `GoogleService-Info.plist` — they are still required by `expo-notifications` for Firebase Cloud Messaging (push notifications). Only Firebase Auth is being removed, not FCM.

- [ ] **Step 4: Verify no TypeScript errors from removed packages**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only from `firebase`/`@react-native-google-signin` imports (not yet updated — that's fine, upcoming tasks fix them).

- [ ] **Step 5: Commit**

```bash
cd frontend
git add package.json package-lock.json app.json
git commit -m "chore: swap firebase/google-signin/apple-auth for aws-amplify"
```

---

## Task 2: Create Amplify configuration and initialise in app entry

**Files:**
- Create: `frontend/lib/amplify.ts`
- Modify: `frontend/app/_layout.tsx`

- [ ] **Step 1: Add environment variables**

Add to your `.env` (and EAS `eas.json` / environment variables):

```
EXPO_PUBLIC_AWS_REGION=eu-west-2
EXPO_PUBLIC_COGNITO_USER_POOL_ID=eu-west-2_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
EXPO_PUBLIC_COGNITO_DOMAIN=your-app.auth.eu-west-2.amazoncognito.com
```

> Replace placeholders with values from the AWS Console prerequisites above.

- [ ] **Step 2: Create `frontend/lib/amplify.ts`**

```typescript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        oauth: {
          domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN!,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: ['onsite-monday://'],
          redirectSignOut: ['onsite-monday://'],
          responseType: 'code',
        },
      },
    },
  },
});
```

- [ ] **Step 3: Import Amplify config at the top of `frontend/app/_layout.tsx`**

Add this as the very first import (before React, Expo Router, etc.):

```typescript
import '@/lib/amplify';
```

> This must be the first import so Amplify is configured before any auth calls happen.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add lib/amplify.ts app/_layout.tsx .env
git commit -m "feat: configure Amplify v6 for Cognito User Pool"
```

---

## Task 3: Rewrite AuthContext to use Amplify Auth

**Files:**
- Modify: `frontend/context/AuthContext.tsx`

This is the biggest frontend change. Replace the entire file.

- [ ] **Step 1: Replace `frontend/context/AuthContext.tsx` entirely**

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentUser,
  signIn,
  signUp,
  confirmSignUp,
  signOut as amplifySignOut,
  signInWithRedirect,
  fetchAuthSession,
  type AuthUser,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthContextType {
  cognitoUser: AuthUser | null;
  isAuthLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  confirmSignUpCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [cognitoUser, setCognitoUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    // Check current auth state on mount
    getCurrentUser()
      .then(user => setCognitoUser(user))
      .catch(() => setCognitoUser(null))
      .finally(() => setIsAuthLoading(false));

    // Listen for auth events (sign in, sign out, Hosted UI callback)
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
      }
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { isSignedIn, nextStep } = await signIn({ username: email, password });
    if (!isSignedIn && nextStep.signInStep !== 'DONE') {
      throw new Error(`Unexpected sign-in step: ${nextStep.signInStep}`);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string
  ): Promise<{ needsConfirmation: boolean }> => {
    const { isSignUpComplete, nextStep } = await signUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
    return { needsConfirmation: !isSignUpComplete && nextStep.signUpStep === 'CONFIRM_SIGN_UP' };
  };

  const confirmSignUpCode = async (email: string, code: string) => {
    await confirmSignUp({ username: email, confirmationCode: code });
    // Confirmation only — the sign-up screen calls signInWithEmail afterward
    // because we don't hold the password here.
  };

  const signOut = async () => {
    await amplifySignOut();
  };

  const signInWithGoogle = async () => {
    await signInWithRedirect({ provider: 'Google' });
  };

  const signInWithApple = async () => {
    await signInWithRedirect({ provider: 'Apple' });
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
        signInWithApple,
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
```

> **Note:** `signInWithRedirect` for Google/Apple opens the Cognito Hosted UI in the system browser. The Hub `signedIn` event fires when the app resumes via the `onsite-monday://` deep link.

> **Note on `confirmSignUpCode`:** The auto-sign-in after confirmation requires Amplify's `ALLOW_USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` on the App Client. If auto-sign-in fails, the user will be prompted to sign in again in the sign-up screen (handled in Task 7).

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "AuthContext"
```

Expected: No errors in `AuthContext.tsx` itself. Other files will still error until updated in later tasks.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add context/AuthContext.tsx
git commit -m "feat: replace Firebase auth with Amplify Cognito in AuthContext"
```

---

## Task 4: Update AppContext to use `cognitoUser`

**Files:**
- Modify: `frontend/context/AppContext.tsx` (lines 53, 65, 109)

AppContext only uses `firebaseUser` as a truthiness check — three lines need changing.

- [ ] **Step 1: Update line 53** — change the destructured property name

```typescript
// Before:
const { firebaseUser } = useAuth();

// After:
const { cognitoUser } = useAuth();
```

- [ ] **Step 2: Update line 65** — the null guard

```typescript
// Before:
if (!firebaseUser) {

// After:
if (!cognitoUser) {
```

- [ ] **Step 3: Update line 109** — the `useEffect` dependency array

```typescript
// Before:
}, [firebaseUser]);

// After:
}, [cognitoUser]);
```

Also update the comment on line 63:
```typescript
// Before:
// Load all app data when Firebase user becomes available

// After:
// Load all app data when Cognito user becomes available
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "AppContext"
```

Expected: No errors in `AppContext.tsx`.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add context/AppContext.tsx
git commit -m "feat: update AppContext to use cognitoUser from new AuthContext"
```

---

## Task 5: Update token retrieval in API service and SignalR service

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/services/signalRService.ts`

Both files currently import `auth` from `@/lib/firebase` to get the current user's ID token. Replace with Amplify's `fetchAuthSession`.

- [ ] **Step 1: Update `frontend/src/services/api.ts`**

Remove the Firebase import and replace token retrieval:

```typescript
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
```

- [ ] **Step 2: Update `frontend/src/services/signalRService.ts`**

Replace the Firebase import and token factory:

```typescript
import * as signalR from '@microsoft/signalr';
import Constants from 'expo-constants';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Message } from '@/constants/types';

function hubUrl(): string {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (__DEV__
      ? `http://${(Constants.expoConfig?.hostUri ?? 'localhost:8081').split(':')[0]}:5236/api`
      : 'https://api.onsitemonday.co.uk/api');
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return `${baseUrl}/hubs/chat`;
}

interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isRead: boolean;
  sentAt: string;
}

function toMessage(m: ApiMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    timestamp: m.sentAt,
    isRead: m.isRead,
  };
}

type MessageHandler = (message: Message) => void;

let connection: signalR.HubConnection | null = null;
const handlers = new Set<MessageHandler>();

function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl(), {
        accessTokenFactory: async () => {
          try {
            const session = await fetchAuthSession();
            return session.tokens?.idToken?.toString() ?? '';
          } catch {
            return '';
          }
        },
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveMessage', (raw: ApiMessage) => {
      const msg = toMessage(raw);
      handlers.forEach(h => h(msg));
    });
  }
  return connection;
}

export const signalRService = {
  async start(): Promise<void> {
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
  },

  async stop(): Promise<void> {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.stop();
    }
  },

  async joinConversation(conversationId: string): Promise<void> {
    await getConnection().invoke('JoinConversation', conversationId);
  },

  async leaveConversation(conversationId: string): Promise<void> {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke('LeaveConversation', conversationId);
    }
  },

  onReceiveMessage(handler: MessageHandler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
};
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "api\.ts|signalRService"
```

Expected: No errors in these two files.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/services/api.ts src/services/signalRService.ts
git commit -m "feat: use Amplify fetchAuthSession for Bearer token in API and SignalR"
```

---

## Task 6: Update sign-in screen — social sign-in handlers

**Files:**
- Modify: `frontend/app/sign-in.tsx`

The Google and Apple sign-in buttons currently call `signInWithGoogle()` and `signInWithApple()` which returned `UserCredential`. They now return `Promise<void>` (Hosted UI redirect — no return value). Update the handlers.

- [ ] **Step 1: Find the Google and Apple button `onPress` handlers in `sign-in.tsx`**

Look for the pattern:
```typescript
const handleGoogleSignIn = async () => {
  try {
    await signInWithGoogle();
    // ... navigation
  } catch (error) { ... }
};
```

- [ ] **Step 2: Remove post-sign-in navigation from both social handlers**

With Hosted UI, `signInWithRedirect` opens a browser and returns immediately — the Hub listener in `AuthContext` handles the `signedIn` event and updates `cognitoUser`, which `index.tsx` uses to navigate. There is no return value to act on.

Update both handlers to:
```typescript
const handleGoogleSignIn = async () => {
  try {
    await signInWithGoogle();
    // Navigation is handled automatically when Hub fires 'signedIn'
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Google sign-in failed';
    Alert.alert('Error', msg);
  }
};

const handleAppleSignIn = async () => {
  try {
    await signInWithApple();
    // Navigation is handled automatically when Hub fires 'signedIn'
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Apple sign-in failed';
    Alert.alert('Error', msg);
  }
};
```

- [ ] **Step 3: Remove the iOS-only conditional on the Apple button**

With Cognito Hosted UI, Apple Sign In works on both iOS and Android (web-based OAuth). Remove `Platform.OS === 'ios'` guard if present on the Apple button.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add app/sign-in.tsx
git commit -m "feat: update sign-in social handlers for Cognito Hosted UI"
```

---

## Task 7: Update sign-up screen — email confirmation code step

**Files:**
- Modify: `frontend/app/sign-up.tsx`

Cognito requires users to confirm their email with a 6-digit code after `signUp`. The current flow jumps from account creation (slide 0) straight into profile setup (slide 1). A confirmation step must be inserted.

- [ ] **Step 1: Add `confirmSignUpCode` to the destructured auth context**

In `sign-up.tsx`, where `useAuth()` is called:
```typescript
const { signUpWithEmail, signInWithGoogle, signInWithApple, signInWithEmail, confirmSignUpCode } = useAuth();
```

- [ ] **Step 2: Add state variables for the confirmation step**

Inside the component, add:
```typescript
const [pendingEmail, setPendingEmail] = useState('');
const [pendingPassword, setPendingPassword] = useState('');
const [showConfirmation, setShowConfirmation] = useState(false);
const [confirmationCode, setConfirmationCode] = useState('');
const [confirmError, setConfirmError] = useState('');
```

- [ ] **Step 3: Update the `handleEmailSignUp` handler on slide 0**

Find the handler that calls `signUpWithEmail`. Replace it with:

```typescript
const handleEmailSignUp = async () => {
  try {
    setIsLoading(true);
    const { needsConfirmation } = await signUpWithEmail(email, password);
    if (needsConfirmation) {
      setPendingEmail(email);
      setPendingPassword(password);
      setShowConfirmation(true);
    } else {
      setCurrentSlide(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sign-up failed';
    Alert.alert('Error', msg);
  } finally {
    setIsLoading(false);
  }
};
```

- [ ] **Step 4: Add `handleConfirmCode` handler**

```typescript
const handleConfirmCode = async () => {
  if (confirmationCode.length !== 6) {
    setConfirmError('Please enter the 6-digit code from your email.');
    return;
  }
  try {
    setIsLoading(true);
    setConfirmError('');
    await confirmSignUpCode(pendingEmail, confirmationCode);
    // After confirmation, sign in explicitly with the stored password
    await signInWithEmail(pendingEmail, pendingPassword);
    setShowConfirmation(false);
    setCurrentSlide(1);
  } catch (error) {
    setConfirmError('Verification failed. Check the code and try again.');
  } finally {
    setIsLoading(false);
  }
};
```

- [ ] **Step 5: Add a confirmation code overlay/modal to the JSX**

After the main slide view, add:

```tsx
{showConfirmation && (
  <View style={styles.confirmationOverlay}>
    <View style={styles.confirmationCard}>
      <Text style={styles.confirmationTitle}>Check your email</Text>
      <Text style={styles.confirmationSubtitle}>
        We sent a 6-digit code to {pendingEmail}
      </Text>
      <TextInput
        style={styles.confirmationInput}
        value={confirmationCode}
        onChangeText={setConfirmationCode}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {confirmError ? (
        <Text style={styles.confirmationError}>{confirmError}</Text>
      ) : null}
      <TouchableOpacity
        style={styles.confirmationButton}
        onPress={handleConfirmCode}
        disabled={isLoading}
      >
        <Text style={styles.confirmationButtonText}>
          {isLoading ? 'Verifying…' : 'Verify'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

Add styles to `StyleSheet.create`:
```typescript
confirmationOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 100,
},
confirmationCard: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 28,
  width: '85%',
  alignItems: 'center',
},
confirmationTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: '#8B2020',
  marginBottom: 8,
},
confirmationSubtitle: {
  fontSize: 14,
  color: '#666',
  textAlign: 'center',
  marginBottom: 24,
},
confirmationInput: {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  fontSize: 28,
  letterSpacing: 8,
  textAlign: 'center',
  paddingVertical: 12,
  paddingHorizontal: 16,
  width: '100%',
  marginBottom: 8,
},
confirmationError: {
  color: '#8B2020',
  fontSize: 13,
  textAlign: 'center',
  marginBottom: 12,
},
confirmationButton: {
  backgroundColor: '#8B2020',
  borderRadius: 8,
  paddingVertical: 14,
  paddingHorizontal: 32,
  marginTop: 8,
},
confirmationButtonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 16,
},
```

- [ ] **Step 6: Update social sign-in handlers in sign-up.tsx (same as sign-in.tsx)**

Find Google/Apple handlers in sign-up.tsx and remove post-sign-in navigation (same as Task 6 Step 2).

- [ ] **Step 7: Commit**

```bash
cd frontend
git add app/sign-up.tsx
git commit -m "feat: add Cognito email confirmation code step to sign-up flow"
```

---

## Task 8: Delete Firebase lib files

**Files:**
- Delete: `frontend/lib/firebase.ts`
- Delete: `frontend/lib/googleAuth.ts`
- Delete: `frontend/lib/appleAuth.ts`

- [ ] **Step 1: Delete the three Firebase/social auth files**

```bash
cd frontend
rm lib/firebase.ts lib/googleAuth.ts lib/appleAuth.ts
```

- [ ] **Step 2: Run full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: Zero errors. If any remain, they will be import errors pointing to the deleted files — fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add -u lib/firebase.ts lib/googleAuth.ts lib/appleAuth.ts
git commit -m "chore: remove Firebase auth and native social sign-in lib files"
```

---

## Task 9: Backend — rename `FirebaseUid` → `CognitoSub`

All 13 backend files use the string `FirebaseUid` as a property name or method name segment. This task renames them all and creates an EF Core migration to rename the database column.

**Files:** `Domain/User.cs`, `Repositories/Interfaces/IUserRepository.cs`, `Repositories/UserRepository.cs`, `Services/UserService.cs`, all 6 controllers, `Data/DataSeeder.cs`

- [ ] **Step 1: Rename in `Domain/User.cs`**

```csharp
// Before:
public string FirebaseUid { get; set; } = null!;

// After:
public string CognitoSub { get; set; } = null!;
```

- [ ] **Step 2: Rename in `Repositories/Interfaces/IUserRepository.cs`**

```csharp
// Before:
Task<User?> GetByFirebaseUidAsync(string firebaseUid);
Task<User> GetOrCreateByFirebaseUidAsync(string firebaseUid, string email);

// After:
Task<User?> GetByCognitoSubAsync(string cognitoSub);
Task<User> GetOrCreateByCognitoSubAsync(string cognitoSub, string email);
```

- [ ] **Step 3: Rename in `Repositories/UserRepository.cs`**

```csharp
// Before:
public Task<User?> GetByFirebaseUidAsync(string firebaseUid) =>
    _db.Users.Include(u => u.Subscriptions).FirstOrDefaultAsync(u => u.FirebaseUid == firebaseUid);

public async Task<User> GetOrCreateByFirebaseUidAsync(string firebaseUid, string email)
{
    var user = await GetByFirebaseUidAsync(firebaseUid);
    if (user != null) return user;

    user = new User
    {
        Id = Guid.NewGuid(),
        FirebaseUid = firebaseUid,
        // ...
    };
    // ...
    return await GetByFirebaseUidAsync(firebaseUid)
        ?? throw new InvalidOperationException("User creation conflict could not be resolved.");
}

// After:
public Task<User?> GetByCognitoSubAsync(string cognitoSub) =>
    _db.Users.Include(u => u.Subscriptions).FirstOrDefaultAsync(u => u.CognitoSub == cognitoSub);

public async Task<User> GetOrCreateByCognitoSubAsync(string cognitoSub, string email)
{
    var user = await GetByCognitoSubAsync(cognitoSub);
    if (user != null) return user;

    user = new User
    {
        Id = Guid.NewGuid(),
        CognitoSub = cognitoSub,
        Email = email,
        FirstName = string.Empty,
        LastName = string.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    _db.Users.Add(user);
    try
    {
        await _db.SaveChangesAsync();
        return user;
    }
    catch (DbUpdateException)
    {
        _db.ChangeTracker.Clear();
        return await GetByCognitoSubAsync(cognitoSub)
            ?? throw new InvalidOperationException("User creation conflict could not be resolved.");
    }
}
```

- [ ] **Step 4: Update `Services/UserService.cs`**

Search for all calls to `GetByFirebaseUidAsync`, `GetOrCreateByFirebaseUidAsync`, and any property access `.FirebaseUid`. Rename:
- `GetByFirebaseUidAsync(...)` → `GetByCognitoSubAsync(...)`
- `GetOrCreateByFirebaseUidAsync(...)` → `GetOrCreateByCognitoSubAsync(...)`
- `.FirebaseUid` → `.CognitoSub`

Run: `grep -n "FirebaseUid\|GetByFirebase\|GetOrCreateByFirebase" Services/UserService.cs` to find all occurrences first.

- [ ] **Step 5: Update all 6 controllers**

Each controller has the same pattern:
```csharp
// Before:
private string FirebaseUid =>
    User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? throw new UnauthorizedAccessException("No uid claim.");
```

```csharp
// After:
private string CognitoSub =>
    User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? throw new UnauthorizedAccessException("No sub claim.");
```

> **Important:** `ClaimTypes.NameIdentifier` maps to the JWT `sub` claim, which is identical in both Firebase and Cognito tokens. The **claim extraction code does not change** — only the property name changes.

Also update all call sites in each controller:
- `GetOrCreateByFirebaseUidAsync(FirebaseUid, Email)` → `GetOrCreateByCognitoSubAsync(CognitoSub, Email)`
- `_userService.GetOrCreateCurrentUserAsync(FirebaseUid, ...)` → `_userService.GetOrCreateCurrentUserAsync(CognitoSub, ...)`
- `_userService.UpdateCurrentUserAsync(FirebaseUid, ...)` → `_userService.UpdateCurrentUserAsync(CognitoSub, ...)`
- `_userService.CompleteOnboardingAsync(FirebaseUid)` → `_userService.CompleteOnboardingAsync(CognitoSub)`

Files to update:
- `Controllers/UsersController.cs`
- `Controllers/JobsController.cs`
- `Controllers/ConversationsController.cs`
- `Controllers/ReviewsController.cs`
- `Controllers/NotificationsController.cs`
- `Controllers/SubscriptionsController.cs`
- `Controllers/DevicesController.cs`

Run: `grep -rn "FirebaseUid" Controllers/` to verify zero occurrences after updating.

- [ ] **Step 6: Update `Data/DataSeeder.cs`**

Run: `grep -n "FirebaseUid" Data/DataSeeder.cs` and rename each occurrence to `CognitoSub`.

- [ ] **Step 7: Build to check for compile errors**

```bash
cd backend/src/OnsiteMonday.Api
dotnet build 2>&1 | grep -E "error|warning" | head -30
```

Expected: Build succeeds. Zero errors.

- [ ] **Step 8: Create EF Core migration to rename the column**

```bash
dotnet ef migrations add RenameFirebaseUidToCognitoSub
```

Open the generated migration file. Verify it contains:
```csharp
migrationBuilder.RenameColumn(
    name: "FirebaseUid",
    table: "Users",
    newName: "CognitoSub");

migrationBuilder.RenameIndex(
    name: "IX_Users_FirebaseUid",   // only if an index exists
    table: "Users",
    newName: "IX_Users_CognitoSub");
```

If the migration auto-generates a drop+recreate instead of a rename, manually replace it with `RenameColumn`.

- [ ] **Step 9: Commit**

```bash
cd backend
git add src/OnsiteMonday.Api/
git commit -m "feat: rename FirebaseUid to CognitoSub across backend + EF migration"
```

---

## Task 10: Backend — update JWT validation to Cognito

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Program.cs`
- Modify: `backend/src/OnsiteMonday.Api/appsettings.json`

- [ ] **Step 1: Update `appsettings.json`**

Replace the `Firebase` section with:
```json
"Aws": {
  "Region": "",
  "CognitoUserPoolId": "",
  "CognitoClientId": ""
}
```

> Fill in values for your non-production environment (Development/Testing). Production values should come from AWS Secrets Manager / environment variables, not this file.

- [ ] **Step 2: Replace JWT auth configuration in `Program.cs`**

Replace lines 39–65 (the Firebase JWT block):

```csharp
// Before:
var firebaseProjectId = builder.Configuration["Firebase:ProjectId"]!;
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.Authority = $"https://securetoken.google.com/{firebaseProjectId}";
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://securetoken.google.com/{firebaseProjectId}",
            ValidateAudience = true,
            ValidAudience = firebaseProjectId,
            ValidateLifetime = true,
        };
        opts.Events = new JwtBearerEvents { ... };
    });
```

```csharp
// After:
var awsRegion = builder.Configuration["Aws:Region"]!;
var cognitoUserPoolId = builder.Configuration["Aws:CognitoUserPoolId"]!;
var cognitoClientId = builder.Configuration["Aws:CognitoClientId"]!;
var cognitoAuthority = $"https://cognito-idp.{awsRegion}.amazonaws.com/{cognitoUserPoolId}";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.Authority = cognitoAuthority;
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = cognitoAuthority,
            ValidateAudience = true,
            ValidAudience = cognitoClientId,
            ValidateLifetime = true,
        };
        // SignalR WebSocket can't send headers — read token from query string instead
        opts.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });
```

- [ ] **Step 3: Build to verify**

```bash
cd backend/src/OnsiteMonday.Api
dotnet build 2>&1 | grep -E "^.*error"
```

Expected: Zero build errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/OnsiteMonday.Api/Program.cs src/OnsiteMonday.Api/appsettings.json
git commit -m "feat: replace Firebase JWT validation with Cognito JWKS in Program.cs"
```

---

## Verification

### Frontend end-to-end tests

Run TypeScript check (must pass clean):
```bash
cd frontend
npx tsc --noEmit
```

Verify each auth flow in a dev build (`npx expo run:ios`):

1. **Email sign-up:**
   - Tap "Let's get started" → slide 0 → enter email + password → tap Next
   - Confirmation overlay appears → enter 6-digit code from email → tap Verify
   - Profile setup slides 1–8 complete → lands on Jobs tab

2. **Email sign-in:**
   - Sign out → tap "Sign In" → enter email + password → lands on Jobs tab

3. **Google sign-in (Hosted UI):**
   - Tap "Continue with Google" → Cognito Hosted UI opens in browser → sign in with Google → app resumes → lands on Jobs tab

4. **Apple sign-in (Hosted UI, iOS only):**
   - Tap "Continue with Apple" → Cognito Hosted UI opens → Apple OAuth → app resumes → lands on Jobs tab

5. **Token passed to backend:**
   - After sign-in, check that `GET /api/users/me` returns 200 (not 401).

6. **Sign out:**
   - Tap sign out → returns to welcome screen → all app data cleared.

### Backend end-to-end test

```bash
cd backend/src/OnsiteMonday.Api

# Build
dotnet build

# Apply migration (requires running PostgreSQL)
dotnet ef database update

# Start API
dotnet run

# Health check (no auth)
curl http://localhost:5236/api/health
# Expected: {"status":"healthy",...}

# Authenticated endpoint — obtain a Cognito ID token from sign-in first, then:
curl -H "Authorization: Bearer <COGNITO_ID_TOKEN>" http://localhost:5236/api/users/me
# Expected: 200 with user JSON (or 404 if first-time login — that's correct, GET /me creates the user)
```
