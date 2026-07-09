# Pre-signed S3 Upload via .NET Backend

**Date:** 2026-07-09  
**Status:** Approved

## Problem

The frontend was using Amplify Storage to upload profile images directly to S3. This requires a Cognito Identity Pool to exchange user tokens for temporary AWS IAM credentials. No Identity Pool is configured, causing "Credentials should not be empty" errors on every upload attempt.

## Solution

Move S3 credential ownership to the backend. The frontend asks the backend for a short-lived pre-signed PUT URL, then uploads the image blob directly to S3 using that URL. No AWS credentials live on the client.

## Architecture

```
Frontend                          Backend (.NET)               AWS S3
   |                                    |                         |
   |-- GET /api/users/me/              |                         |
   |   profile-image-upload-url        |                         |
   |   ?contentType=image/jpeg ------->|                         |
   |                                   |-- GeneratePresignedUrl->|
   |                                   |<- { uploadUrl, pubUrl } |
   |<-- { uploadUrl, publicUrl } ------|                         |
   |                                                             |
   |-- PUT {uploadUrl} (blob) ---------------------------------->|
   |<-- 200 OK --------------------------------------------------|
   |                                                             |
   | store publicUrl on user profile                            |
```

## Backend Changes

### 1. NuGet Package
Add `AWSSDK.S3` to `OnsiteMonday.Api.csproj`.

### 2. Configuration
Add to `appsettings.Development.json` under the existing `Aws` block:
```json
"Aws": {
  "Region": "eu-west-2",
  "CognitoUserPoolId": "...",
  "CognitoClientId": "...",
  "S3Bucket": "onsite-monday-media"
}
```
In production the bucket name is supplied via environment variable `AWS__S3Bucket` (double-underscore = nested key in .NET config).

AWS credentials are resolved by the SDK's default credential chain: `~/.aws/credentials` locally, IAM role in production. No keys in code or config.

### 3. IStorageService Interface
```
IStorageService
  Task<(string UploadUrl, string PublicUrl)> GenerateProfileImageUploadUrlAsync(string userId, string contentType)
```

### 4. S3StorageService Implementation
- Creates an `AmazonS3Client` using `RegionEndpoint.EUWest2` (credentials from default chain)
- Builds path: `profile-images/{userId}.{ext}` (ext derived from contentType)
- Calls `GetPreSignedURL` with `HttpVerb.PUT`, expiry 5 minutes, explicit `ContentType`
- Returns the pre-signed URL and the permanent public URL: `https://{bucket}.s3.eu-west-2.amazonaws.com/{path}`

### 5. Endpoint
`POST /api/users/me/profile-image-upload-url`  
Body: `{ "contentType": "image/jpeg" }`  
Added to `UsersController`, requires auth. Returns:
```json
{ "uploadUrl": "https://onsite-monday-media.s3.eu-west-2.amazonaws.com/...", "publicUrl": "https://..." }
```

### 6. Program.cs Registration
```csharp
builder.Services.AddScoped<IStorageService, S3StorageService>();
```

## Frontend Changes

### 1. amplify.ts
Remove the `Storage.S3` block entirely. Amplify is now used for Auth only.

### 2. imageService.ts
Replace the `uploadData()` call with:
1. Call `apiRequest('POST', '/users/me/profile-image-upload-url', { contentType })` to get `{ uploadUrl, publicUrl }`
2. `fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob })`
3. Return `publicUrl`

Remove the `EXPO_PUBLIC_S3_BUCKET` guard and all Amplify Storage imports.

### 3. .env
Remove `EXPO_PUBLIC_S3_BUCKET` — the bucket is now backend-only.

## Error Handling

- Backend returns `400` if `contentType` is not `image/jpeg` or `image/png`
- Backend returns `500` (via global error middleware) if S3 pre-sign fails
- Frontend propagates errors up to the existing photo picker error handling in the UI

## Security

- The pre-signed URL is scoped to a single PUT on `profile-images/{userId}.{ext}` — a user cannot use it to overwrite another user's image
- URL expires in 5 minutes
- The S3 bucket policy grants public read on `profile-images/*` (existing configuration)
- No AWS credentials are exposed to the client at any point
