# Sign In with Apple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sign In with Apple via Firebase Auth to satisfy the Apple App Store requirement that any app offering third-party social login must also offer Sign In with Apple.

**Architecture:** Mirror the existing Google Sign-In pattern exactly — a `lib/appleAuth.ts` service handles the native Apple credential + Firebase exchange, `AuthContext` exposes `signInWithApple` via lazy require (prevents crashes in environments where the native module isn't available), and both sign-in and sign-up screens render the `AppleAuthenticationButton` component (iOS only, using `Platform.OS === 'ios'` guard).

**Tech Stack:** `expo-apple-authentication` (native Apple Sign-In, already in Expo 54 bundledNativeModules), `expo-crypto` (SHA-256 nonce hashing required by Firebase + Apple), Firebase `OAuthProvider('apple.com')` + `signInWithCredential`.

---

## Pre-requisites (Manual Steps — Do Before Coding)

### A. Enable Apple Sign-In in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com) → project `onsite-monday` → Authentication → Sign-in method
2. Click **Apple** → Enable it
3. Copy the **callback URL** shown (looks like `https://onsite-monday.firebaseapp.com/__/auth/handler`)

### B. Configure Apple Developer Account
1. Sign in to [Apple Developer](https://developer.apple.com)
2. Go to **Identifiers** → find `com.onsitemonday.app` → enable **Sign In with Apple** capability → Save
3. Create a new **Services ID** (e.g. `com.onsitemonday.app.siwa`):
   - Enable Sign In with Apple
   - Configure: add `onsite-monday.firebaseapp.com` as a domain, paste the Firebase callback URL as the redirect URI
4. Back in Firebase Console, paste the Services ID into the Apple sign-in config → Save

> EAS Build reads `usesAppleSignIn: true` from `app.json` and automatically adds the `com.apple.developer.applesignin` entitlement — no manual Xcode steps needed.

---

## File Map

| Action | Path |
|--------|------|
| Create | `frontend/lib/appleAuth.ts` |
| Modify | `frontend/app.json` |
| Modify | `frontend/context/AuthContext.tsx` |
| Modify | `frontend/app/sign-in.tsx` |
| Modify | `frontend/app/sign-up.tsx` |

---

## Task 1: Install Dependencies & Configure app.json

**Files:**
- Modify: `frontend/app.json`

- [ ] **Step 1: Install expo-apple-authentication and expo-crypto**

```bash
cd frontend
npx expo install expo-apple-authentication expo-crypto
```

Expected: both packages added to `package.json` dependencies with Expo-compatible versions.

- [ ] **Step 2: Add iOS capability and plugin to app.json**

In `frontend/app.json`, make two additions:

1. Inside `"ios": { ... }` (after line 22, before the closing `}`), add:
```json
      "usesAppleSignIn": true,
```

2. Inside `"plugins": [ ... ]` (after the `@react-native-google-signin/google-signin` entry, before the closing `]`), add:
```json
      "expo-apple-authentication"
```

Full `ios` block after edit:
```json
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.onsitemonday.app",
      "googleServicesFile": "./GoogleService-Info.plist",
      "usesAppleSignIn": true,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
```

Full `plugins` array after edit:
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
      "@react-native-community/datetimepicker",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.838911528327-ninil92kp7cv5v579o2kacleam90c4n7"
        }
      ],
      "expo-apple-authentication"
    ],
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app.json frontend/package.json frontend/package-lock.json
git commit -m "chore: install expo-apple-authentication + expo-crypto; enable Sign In with Apple entitlement"
```

---

## Task 2: Create Apple Auth Service

**Files:**
- Create: `frontend/lib/appleAuth.ts`

- [ ] **Step 1: Create the service file**

Create `frontend/lib/appleAuth.ts`:

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

function generateNonce(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function signInWithApple() {
  const rawNonce = generateNonce(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const { identityToken } = appleCredential;
  if (!identityToken) {
    throw new Error('Apple sign-in succeeded but returned no identity token.');
  }

  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: identityToken,
    rawNonce,
  });

  return signInWithCredential(auth, firebaseCredential);
}
```

> The nonce flow: raw nonce → SHA-256 → sent to Apple (in the JWT) → raw nonce sent to Firebase → Firebase verifies the hash matches. This prevents replay attacks.

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/appleAuth.ts
git commit -m "feat: add Apple Sign-In service with Firebase credential exchange"
```

---

## Task 3: Expose signInWithApple in AuthContext

**Files:**
- Modify: `frontend/context/AuthContext.tsx`

- [ ] **Step 1: Add lazy loader and method**

In `frontend/context/AuthContext.tsx`, replace the entire file with:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/context/AuthContext.tsx
git commit -m "feat: expose signInWithApple in AuthContext"
```

---

## Task 4: Add Apple Sign-In to Sign-In Screen

**Files:**
- Modify: `frontend/app/sign-in.tsx`

- [ ] **Step 1: Add import and update useAuth destructuring**

At line 1, the imports start. Make two changes:

1. Add `import * as AppleAuthentication from 'expo-apple-authentication';` after line 15 (after the `expo-constants` import).

2. At line 20, change:
```typescript
  const { signInWithEmail, signInWithGoogle } = useAuth();
```
to:
```typescript
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
```

3. Add `isAppleSigningIn` state alongside `isGoogleSigningIn` (around line 26):
```typescript
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
```

- [ ] **Step 2: Add handleAppleSignIn handler**

After the `handleGoogleSignIn` function (after line 88), add:

```typescript
  const handleAppleSignIn = async () => {
    setIsAppleSigningIn(true);
    try {
      await signInWithApple();
      router.replace('/(tabs)/jobs');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple sign-in failed', 'Please try again.');
    } finally {
      setIsAppleSigningIn(false);
    }
  };
```

- [ ] **Step 3: Replace social buttons section**

Replace lines 174–197 (the entire `Constants.executionEnvironment !== ExecutionEnvironment.StoreClient` block) with:

```tsx
          {Platform.OS === 'ios' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            </>
          )}
          {Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && (
            <>
              {Platform.OS !== 'ios' && (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}
              <TouchableOpacity
                style={[styles.googleBtn, isGoogleSigningIn && { opacity: 0.7 }]}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
                disabled={isGoogleSigningIn}
              >
                {isGoogleSigningIn ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <>
                    <AntDesign name="google" size={18} color="#DB4437" />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
```

> On iOS in production: divider + Apple button + Google button (no second divider). On Android: divider + Google button. On iOS in Expo Go: divider + Apple button only.

- [ ] **Step 4: Add appleBtn style to StyleSheet**

In the `StyleSheet.create({...})` at the bottom of the file, add after the `googleBtn` style:

```typescript
    appleBtn: {
      width: '100%',
      height: 48,
    },
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/sign-in.tsx
git commit -m "feat: add Sign In with Apple button to sign-in screen (iOS only)"
```

---

## Task 5: Add Apple Sign-In to Sign-Up Screen

**Files:**
- Modify: `frontend/app/sign-up.tsx`

- [ ] **Step 1: Add import and update useAuth destructuring**

1. Add `import * as AppleAuthentication from 'expo-apple-authentication';` after line 17 (after the `expo-constants` import).

2. At line 30, change:
```typescript
  const { signUpWithEmail, signInWithGoogle } = useAuth();
```
to:
```typescript
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
```

- [ ] **Step 2: Add appleAuthenticated state**

After line 61 (`const [googleAuthenticated, setGoogleAuthenticated] = useState(false);`), add:

```typescript
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [appleAuthenticated, setAppleAuthenticated] = useState(false);
```

- [ ] **Step 3: Update minSlide and isSlideValid**

At line 64, change:
```typescript
  const minSlide = isReturningUser || googleAuthenticated ? 1 : 0;
```
to:
```typescript
  const minSlide = isReturningUser || googleAuthenticated || appleAuthenticated ? 1 : 0;
```

At line 76, change:
```typescript
      case 0: return googleAuthenticated || (firstName.trim().length > 0 && email.trim().length > 0 && password.length >= 6);
```
to:
```typescript
      case 0: return googleAuthenticated || appleAuthenticated || (firstName.trim().length > 0 && email.trim().length > 0 && password.length >= 6);
```

- [ ] **Step 4: Add handleAppleSignIn handler**

After the `handleGoogleSignIn` function (after line 142), add:

```typescript
  const handleAppleSignIn = async () => {
    setIsAppleSigningIn(true);
    try {
      const result = await signInWithApple();
      const displayName = result.user.displayName ?? '';
      const parts = displayName.trim().split(/\s+/);
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' '));
      setAppleAuthenticated(true);
      pagerRef.current?.scrollToIndex({ index: 1, animated: true });
      setCurrentSlide(1);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple sign-in failed', 'Please try again.');
    } finally {
      setIsAppleSigningIn(false);
    }
  };
```

> Apple only returns `fullName` on the user's very first sign-in. Subsequent sign-ins return `null`. Firebase populates `displayName` from the first sign-in, so this handles returning users gracefully (name fields just stay empty, user can fill them in).

- [ ] **Step 5: Replace social buttons section in slide 0**

Replace lines 225–248 (the Google button block on slide 0) with:

```tsx
        {Platform.OS === 'ios' && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.appleBtn}
              onPress={handleAppleSignIn}
            />
          </>
        )}
        {Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && (
          <>
            {Platform.OS !== 'ios' && (
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.googleBtn, isGoogleSigningIn && { opacity: 0.7 }]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.85}
              disabled={isGoogleSigningIn}
            >
              {isGoogleSigningIn ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <AntDesign name="google" size={18} color="#DB4437" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
```

> Uses `SIGN_UP` button type so Apple renders "Sign up with Apple" text (vs "Sign in with Apple" on the sign-in screen).

- [ ] **Step 6: Add appleBtn style to StyleSheet**

In the `StyleSheet.create({...})` at the bottom of the file, add after the `googleBtn` style:

```typescript
    appleBtn: {
      width: '100%',
      height: 48,
    },
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/sign-up.tsx
git commit -m "feat: add Sign Up with Apple button to sign-up slide 0 (iOS only)"
```

---

## Verification

### TypeScript
```bash
cd frontend && npx tsc --noEmit
```

### Lint
```bash
cd frontend && npx eslint src/ lib/ context/ app/
```

### Manual test (requires iOS device or simulator with Apple ID signed in, via EAS dev build)

**Sign-In screen:**
1. Open app on iOS → tap "Sign In" → the Apple button appears above Google
2. Tap Apple button → native Apple sheet appears → authenticate → routed to `/(tabs)/jobs`
3. Sign out → tap Apple again → account picker shows (or authenticates automatically)

**Sign-Up screen:**
1. Open app on iOS → tap "Sign Up" → slide 0 shows Apple button ("Sign up with Apple") above Google
2. Tap Apple button → authenticate → app jumps to slide 1 (trade selection), name fields pre-filled if available
3. Back button on slide 1 stays on slide 1 (cannot go back to slide 0 after Apple auth)
4. Complete onboarding → routed to `/(tabs)/jobs`

**Android:**
- Apple button does not appear (Platform.OS !== 'ios') — Google-only flow unchanged

### EAS Build (required to test on device)
```bash
cd frontend && eas build --platform ios --profile development
```
