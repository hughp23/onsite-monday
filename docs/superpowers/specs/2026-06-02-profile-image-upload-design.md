# Profile Image Upload — Design Spec

**Date:** 2026-06-02  
**Status:** Approved

---

## Context

Profile photos are a trust signal in a two-sided trades marketplace — job posters want to see who they're hiring, and tradespeople want to present professionally. Currently, the sign-up onboarding (slide 6) has placeholder UI with non-functional buttons, and the edit-profile screen calls `pickAndUploadProfileImage()` but Amplify Storage is not configured, so uploads throw at runtime. This spec covers wiring up both surfaces end-to-end.

---

## Approach

Manual S3 bucket creation (AWS Console) + Amplify Storage v6 configuration. Uploads are authenticated via Cognito credentials; images are served as permanent public URLs (no signed URL expiry). No IaC for now — note as a future CDK cleanup item when staging is set up.

---

## Infrastructure (Manual — AWS Console, eu-west-2)

### S3 Bucket

- **Bucket name:** `onsite-monday-media` (or similar — record the actual name)
- **Region:** `eu-west-2`
- **Block all public access:** Disable this setting at the bucket level — the bucket policy below restricts public read to the `profile-images/*` prefix only, so other prefixes remain private by default
- **Versioning:** Disabled (overwrite on re-upload is intentional)

### CORS Rule

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Bucket Policy (public read on profile-images only)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadProfileImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::onsite-monday-media/profile-images/*"
    }
  ]
}
```

Uploads use Cognito credentials (authenticated write) — the bucket policy only grants public **read**, not write.

> **Future CDK note:** When a staging environment is created, codify this bucket + the Cognito user pool into a CDK stack.

---

## Code Changes

### 1. Environment variable

**File:** `frontend/.env` (and `.env.example`)

```
EXPO_PUBLIC_S3_BUCKET=onsite-monday-media
```

---

### 2. `lib/amplify.ts` — Add Storage config

Add a `Storage.S3` block alongside the existing `Auth` block in `Amplify.configure()`.

**File:** `frontend/lib/amplify.ts`

```ts
Amplify.configure({
  Auth: { /* existing — unchanged */ },
  Storage: {
    S3: {
      bucket: process.env.EXPO_PUBLIC_S3_BUCKET!,
      region: 'eu-west-2',
    },
  },
});
```

---

### 3. `src/services/imageService.ts` — Refactor + add camera support

**Changes:**
- Rename `pickAndUploadProfileImage()` → `uploadProfileImage(source: 'library' | 'camera')`
- Replace `getUrl({ key })` (returns expiring signed URL) with a constructed permanent public URL
- Request camera permission when `source === 'camera'`
- Launch `launchCameraAsync` vs `launchImageLibraryAsync` based on `source`

**Public URL construction:**
```ts
const bucket = process.env.EXPO_PUBLIC_S3_BUCKET!;
const publicUrl = `https://${bucket}.s3.eu-west-2.amazonaws.com/${key}`;
return publicUrl;
```

**Object key:** `profile-images/${user.userId}.jpg` (unchanged — overwrites previous photo on re-upload)

**Exports:**
- `uploadProfileImage(source: 'library' | 'camera'): Promise<string | typeof CANCELLED>`
- `CANCELLED` sentinel (unchanged)

---

### 4. `app/sign-up.tsx` — Wire onboarding slide 6

**State additions:**
```ts
const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
```

**Handler:**
```ts
const handlePickPhoto = async (source: 'library' | 'camera') => {
  setIsUploadingPhoto(true);
  try {
    const result = await uploadProfileImage(source);
    if (result !== CANCELLED) setProfileImageUri(result);
  } catch (e) {
    Alert.alert('Photo upload failed', e instanceof Error ? e.message : 'Please try again.');
  } finally {
    setIsUploadingPhoto(false);
  }
};
```

**Slide 6 UI changes:**
- Replace `photoPlaceholder` with an `Image` component when `profileImageUri` is set; keep placeholder icon otherwise
- Add `ActivityIndicator` overlay while `isUploadingPhoto` is true
- Wire "Take Photo" button: `onPress={() => handlePickPhoto('camera')}`
- Wire "Choose from Library" button: `onPress={() => handlePickPhoto('library')}`
- Disable both buttons while uploading
- Skip link already has `onPress={goNext}` — no change

**`handleComplete` addition:**
```ts
await updateCurrentUser({
  // ...existing fields...
  profileImage: profileImageUri ?? undefined,
});
```

---

### 5. `app/edit-profile.tsx` — Add camera option

Currently tapping the photo circle calls `pickAndUploadProfileImage()` (library only). Replace with an `Alert`-based action sheet offering Camera / Photo Library / Cancel, then call `uploadProfileImage` with the chosen source.

```ts
const handleChangePhoto = () => {
  Alert.alert('Profile Photo', 'Choose a source', [
    { text: 'Camera', onPress: () => doUpload('camera') },
    { text: 'Photo Library', onPress: () => doUpload('library') },
    { text: 'Cancel', style: 'cancel' },
  ]);
};

const doUpload = async (source: 'library' | 'camera') => {
  setIsUploading(true);
  try {
    const result = await uploadProfileImage(source);
    if (result !== CANCELLED) setProfileImageUri(result);
  } catch (e) {
    Alert.alert('Photo upload failed', e instanceof Error ? e.message : 'Please try again.');
  } finally {
    setIsUploading(false);
  }
};
```

---

## Permissions (app.json)

`expo-image-picker` is already in `app.json` plugins. Confirm both entries are present:

```json
["expo-image-picker", {
  "photosPermission": "$(PRODUCT_NAME) needs access to your photo library to set a profile photo.",
  "cameraPermission": "$(PRODUCT_NAME) needs camera access to take a profile photo."
}]
```

If `cameraPermission` is missing, add it.

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/.env` | Add `EXPO_PUBLIC_S3_BUCKET` |
| `frontend/.env.example` | Add `EXPO_PUBLIC_S3_BUCKET` placeholder |
| `frontend/lib/amplify.ts` | Add `Storage.S3` config block |
| `frontend/src/services/imageService.ts` | Refactor to `uploadProfileImage(source)`, public URL, camera support |
| `frontend/app/sign-up.tsx` | Wire slide 6 buttons, add state, pass to `handleComplete` |
| `frontend/app/edit-profile.tsx` | Add action sheet for camera/library choice |
| `frontend/app.json` | Add `cameraPermission` if missing |

---

## Verification

1. **S3 config** — confirm Amplify Storage initialises without error (check console logs on app start)
2. **Edit profile** — tap profile photo → action sheet appears → pick from library → spinner → image updates → save → reload confirms URL is stored
3. **Camera path** — tap profile photo → choose Camera → take photo → image updates
4. **Sign-up onboarding** — reach slide 6 → tap "Choose from Library" → image previews in circle → tap Next/Skip → complete onboarding → profile screen shows the photo
5. **Public URL** — copy the stored `profileImage` URL from app state, open it in a browser — should load without auth
6. **Re-upload** — change photo again → new upload overwrites the same S3 key → old URL still resolves (same path)
7. **Permissions denied** — deny camera/library permission → `Alert` with guidance message appears (not a crash)
