# Pre-signed S3 Profile Image Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Amplify's broken direct-to-S3 upload with a backend pre-signed URL flow so no AWS credentials are needed on the mobile client.

**Architecture:** The .NET backend generates a short-lived S3 pre-signed PUT URL using the server's own AWS credentials (SDK default credential chain: `~/.aws/credentials` locally, IAM role in production). The frontend calls a new endpoint to get the URL and the eventual public URL, uploads the blob directly to S3 using a plain `fetch` PUT, then stores the public URL on the user profile. Amplify remains in use for Auth only; its Storage configuration is removed entirely.

**Tech Stack:** AWSSDK.S3 (NuGet), .NET 8 ASP.NET Core, xunit + Moq (backend tests), React Native + Expo (frontend)

## Global Constraints

- AWS region: `eu-west-2`
- S3 bucket: `onsite-monday-media`
- Profile image S3 key: `profile-images/{userId}.{ext}`
- Supported content types: `image/jpeg` → ext `jpg`, `image/png` → ext `png`
- Pre-signed URL expiry: 5 minutes
- Public URL format: `https://{bucket}.s3.eu-west-2.amazonaws.com/{path}`
- Run backend tests from `backend/` directory: `dotnet test`
- Backend test infrastructure: `TestWebApplicationFactory` + `FakeAuthHandler` in `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/`

---

### Task 1: IStorageService, S3StorageService, Program.cs registration

**Files:**
- Create: `backend/src/OnsiteMonday.Api/Services/Interfaces/IStorageService.cs`
- Create: `backend/src/OnsiteMonday.Api/Services/S3StorageService.cs`
- Modify: `backend/src/OnsiteMonday.Api/OnsiteMonday.Api.csproj`
- Modify: `backend/src/OnsiteMonday.Api/appsettings.Development.json`
- Modify: `backend/src/OnsiteMonday.Api/Program.cs`
- Test: `backend/tests/OnsiteMonday.Api.Tests/Unit/StorageServiceTests.cs`

**Interfaces:**
- Produces: `IStorageService.GenerateProfileImageUploadUrlAsync(string userId, string contentType): Task<(string UploadUrl, string PublicUrl)>` — consumed by Task 2

- [ ] **Step 1: Add AWSSDK.S3 NuGet package**

```bash
cd backend/src/OnsiteMonday.Api && dotnet add package AWSSDK.S3
```

Expected: `PackageReference for package 'AWSSDK.S3' version '3.*' added to file '...OnsiteMonday.Api.csproj'`

- [ ] **Step 2: Add S3Bucket to appsettings.Development.json**

In `backend/src/OnsiteMonday.Api/appsettings.Development.json`, add `S3Bucket` inside the existing `Aws` object:

```json
"Aws": {
  "Region": "eu-west-2",
  "CognitoUserPoolId": "eu-west-2_8fC6MhIie",
  "CognitoClientId": "5impapcbro4j53o0bnlnc6c3m3",
  "S3Bucket": "onsite-monday-media"
}
```

- [ ] **Step 3: Write the failing unit tests**

Create `backend/tests/OnsiteMonday.Api.Tests/Unit/StorageServiceTests.cs`:

```csharp
using Amazon.S3;
using Amazon.S3.Model;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using OnsiteMonday.Api.Services;

namespace OnsiteMonday.Api.Tests.Unit;

public class StorageServiceTests
{
    private static IConfiguration MakeConfig(string bucket = "onsite-monday-media") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Aws:S3Bucket"] = bucket,
                ["Aws:Region"] = "eu-west-2",
            })
            .Build();

    [Fact]
    public async Task GenerateProfileImageUploadUrlAsync_Jpeg_ReturnsCorrectUrls()
    {
        var s3Mock = new Mock<IAmazonS3>();
        s3Mock
            .Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Returns("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-123.jpg?X-Amz-Signature=abc");

        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        var (uploadUrl, publicUrl) = await sut.GenerateProfileImageUploadUrlAsync("user-123", "image/jpeg");

        uploadUrl.Should().StartWith("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-123.jpg?");
        publicUrl.Should().Be("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-123.jpg");
    }

    [Fact]
    public async Task GenerateProfileImageUploadUrlAsync_Png_UsesPngExtension()
    {
        var s3Mock = new Mock<IAmazonS3>();
        s3Mock
            .Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Returns("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-456.png?X-Amz-Signature=abc");

        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        var (_, publicUrl) = await sut.GenerateProfileImageUploadUrlAsync("user-456", "image/png");

        publicUrl.Should().EndWith(".png");
    }

    [Fact]
    public async Task GenerateProfileImageUploadUrlAsync_CallsGetPreSignedUrl_WithPutVerbAndCorrectParams()
    {
        GetPreSignedUrlRequest? captured = null;
        var s3Mock = new Mock<IAmazonS3>();
        s3Mock
            .Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Callback<GetPreSignedUrlRequest>(r => captured = r)
            .Returns("https://fake-url");

        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        await sut.GenerateProfileImageUploadUrlAsync("user-789", "image/jpeg");

        captured.Should().NotBeNull();
        captured!.Verb.Should().Be(HttpVerb.PUT);
        captured.BucketName.Should().Be("onsite-monday-media");
        captured.Key.Should().Be("profile-images/user-789.jpg");
        captured.ContentType.Should().Be("image/jpeg");
        captured.Expires.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(5), TimeSpan.FromSeconds(10));
    }
}
```

- [ ] **Step 4: Run tests to confirm they fail at compile**

```bash
cd backend && dotnet test --filter "StorageServiceTests" -v minimal
```

Expected: build error — `S3StorageService` not found

- [ ] **Step 5: Create IStorageService interface**

Create `backend/src/OnsiteMonday.Api/Services/Interfaces/IStorageService.cs`:

```csharp
namespace OnsiteMonday.Api.Services;

public interface IStorageService
{
    Task<(string UploadUrl, string PublicUrl)> GenerateProfileImageUploadUrlAsync(
        string userId, string contentType);
}
```

- [ ] **Step 6: Create S3StorageService**

Create `backend/src/OnsiteMonday.Api/Services/S3StorageService.cs`:

```csharp
using Amazon.S3;
using Amazon.S3.Model;

namespace OnsiteMonday.Api.Services;

public class S3StorageService : IStorageService
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;

    public S3StorageService(IAmazonS3 s3, IConfiguration config)
    {
        _s3 = s3;
        _bucket = config["Aws:S3Bucket"]
            ?? throw new InvalidOperationException("Aws:S3Bucket is not configured.");
    }

    public Task<(string UploadUrl, string PublicUrl)> GenerateProfileImageUploadUrlAsync(
        string userId, string contentType)
    {
        var ext = contentType == "image/png" ? "png" : "jpg";
        var key = $"profile-images/{userId}.{ext}";

        var uploadUrl = _s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddMinutes(5),
        });

        var publicUrl = $"https://{_bucket}.s3.eu-west-2.amazonaws.com/{key}";
        return Task.FromResult((uploadUrl, publicUrl));
    }
}
```

- [ ] **Step 7: Register IAmazonS3 and IStorageService in Program.cs**

Add `using Amazon.S3;` near the top of `backend/src/OnsiteMonday.Api/Program.cs` with the other usings.

Add these two lines after the `// Services` block (before the Mangopay block):

```csharp
// Storage
builder.Services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(Amazon.RegionEndpoint.EUWest2));
builder.Services.AddScoped<IStorageService, S3StorageService>();
```

- [ ] **Step 8: Run tests — confirm 3 pass**

```bash
cd backend && dotnet test --filter "StorageServiceTests" -v minimal
```

Expected: 3 tests pass

- [ ] **Step 9: Commit**

```bash
git add backend/src/OnsiteMonday.Api/OnsiteMonday.Api.csproj \
        backend/src/OnsiteMonday.Api/Services/Interfaces/IStorageService.cs \
        backend/src/OnsiteMonday.Api/Services/S3StorageService.cs \
        backend/src/OnsiteMonday.Api/Program.cs \
        backend/src/OnsiteMonday.Api/appsettings.Development.json \
        backend/tests/OnsiteMonday.Api.Tests/Unit/StorageServiceTests.cs
git commit -m "feat: add S3StorageService with pre-signed URL generation"
```

---

### Task 2: DTOs, endpoint, integration test

**Files:**
- Create: `backend/src/OnsiteMonday.Api/DTOs/Users/ProfileImageUploadUrlRequest.cs`
- Create: `backend/src/OnsiteMonday.Api/DTOs/Users/ProfileImageUploadUrlResponse.cs`
- Modify: `backend/src/OnsiteMonday.Api/Controllers/UsersController.cs`
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Integration/UsersControllerTests.cs`
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/TestWebApplicationFactory.cs`

**Interfaces:**
- Consumes: `IStorageService.GenerateProfileImageUploadUrlAsync(string userId, string contentType)` from Task 1

- [ ] **Step 1: Write the failing integration tests**

Add these three tests to the `UsersControllerTests` class in `backend/tests/OnsiteMonday.Api.Tests/Integration/UsersControllerTests.cs`:

```csharp
[Fact]
public async Task PostProfileImageUploadUrl_WithJpegContentType_Returns200WithUrls()
{
    var response = await _client.PostAsJsonAsync(
        "/api/users/me/profile-image-upload-url",
        new { contentType = "image/jpeg" });

    response.StatusCode.Should().Be(HttpStatusCode.OK);
    var body = await response.Content.ReadFromJsonAsync<ProfileImageUploadUrlResponse>();
    body.Should().NotBeNull();
    body!.UploadUrl.Should().NotBeNullOrEmpty();
    body.PublicUrl.Should().Contain("profile-images/");
    body.PublicUrl.Should().EndWith(".jpg");
}

[Fact]
public async Task PostProfileImageUploadUrl_WithInvalidContentType_Returns400()
{
    var response = await _client.PostAsJsonAsync(
        "/api/users/me/profile-image-upload-url",
        new { contentType = "application/pdf" });

    response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
}

[Fact]
public async Task PostProfileImageUploadUrl_WithoutAuth_Returns401()
{
    var unauthClient = _factory.CreateUnauthenticatedClient();
    var response = await unauthClient.PostAsJsonAsync(
        "/api/users/me/profile-image-upload-url",
        new { contentType = "image/jpeg" });

    response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
}
```

Also ensure `using OnsiteMonday.Api.DTOs.Users;` is present at the top of the file (it already imports `OnsiteMonday.Api.DTOs.Users` — add if missing).

- [ ] **Step 2: Mock IStorageService in TestWebApplicationFactory**

In `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/TestWebApplicationFactory.cs`, add `using OnsiteMonday.Api.Services;` at the top.

Inside `ConfigureWebHost`'s `builder.ConfigureServices` block, add after the `mangopayMock` section:

```csharp
// Override IStorageService — integration tests must not need real AWS credentials
var storageMock = new Mock<IStorageService>();
storageMock
    .Setup(m => m.GenerateProfileImageUploadUrlAsync(It.IsAny<string>(), "image/jpeg"))
    .ReturnsAsync((
        "https://fake-presigned-url?sig=abc",
        "https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/test.jpg"));
storageMock
    .Setup(m => m.GenerateProfileImageUploadUrlAsync(It.IsAny<string>(), "image/png"))
    .ReturnsAsync((
        "https://fake-presigned-url?sig=abc",
        "https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/test.png"));
services.AddScoped<IStorageService>(_ => storageMock.Object);
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd backend && dotnet test --filter "PostProfileImageUploadUrl" -v minimal
```

Expected: build error — `ProfileImageUploadUrlResponse` not found

- [ ] **Step 4: Create DTOs**

Create `backend/src/OnsiteMonday.Api/DTOs/Users/ProfileImageUploadUrlRequest.cs`:

```csharp
namespace OnsiteMonday.Api.DTOs.Users;

public record ProfileImageUploadUrlRequest(string ContentType);
```

Create `backend/src/OnsiteMonday.Api/DTOs/Users/ProfileImageUploadUrlResponse.cs`:

```csharp
namespace OnsiteMonday.Api.DTOs.Users;

public record ProfileImageUploadUrlResponse(string UploadUrl, string PublicUrl);
```

- [ ] **Step 5: Add endpoint to UsersController**

In `backend/src/OnsiteMonday.Api/Controllers/UsersController.cs`:

Update the constructor to inject `IStorageService`:

```csharp
private readonly IUserService _userService;
private readonly IStorageService _storageService;

public UsersController(IUserService userService, IStorageService storageService)
{
    _userService = userService;
    _storageService = storageService;
}
```

Add at the bottom of the class (before closing `}`):

```csharp
// POST /api/users/me/profile-image-upload-url
[HttpPost("me/profile-image-upload-url")]
public async Task<ActionResult<ProfileImageUploadUrlResponse>> GetProfileImageUploadUrl(
    [FromBody] ProfileImageUploadUrlRequest request)
{
    if (request.ContentType is not ("image/jpeg" or "image/png"))
        return BadRequest(new { error = "contentType must be image/jpeg or image/png" });

    var (uploadUrl, publicUrl) = await _storageService.GenerateProfileImageUploadUrlAsync(
        CognitoSub, request.ContentType);

    return Ok(new ProfileImageUploadUrlResponse(uploadUrl, publicUrl));
}
```

Ensure `using OnsiteMonday.Api.DTOs.Users;` is at the top of `UsersController.cs`.

- [ ] **Step 6: Run the new tests — confirm 3 pass**

```bash
cd backend && dotnet test --filter "PostProfileImageUploadUrl" -v minimal
```

Expected: 3 tests pass

- [ ] **Step 7: Run full test suite — no regressions**

```bash
cd backend && dotnet test -v minimal
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add backend/src/OnsiteMonday.Api/DTOs/Users/ProfileImageUploadUrlRequest.cs \
        backend/src/OnsiteMonday.Api/DTOs/Users/ProfileImageUploadUrlResponse.cs \
        backend/src/OnsiteMonday.Api/Controllers/UsersController.cs \
        backend/tests/OnsiteMonday.Api.Tests/Integration/UsersControllerTests.cs \
        backend/tests/OnsiteMonday.Api.Tests/Infrastructure/TestWebApplicationFactory.cs
git commit -m "feat: add POST /api/users/me/profile-image-upload-url endpoint"
```

---

### Task 3: Frontend — Remove Amplify Storage, update imageService

**Files:**
- Modify: `frontend/lib/amplify.ts`
- Modify: `frontend/src/services/imageService.ts`
- Modify: `frontend/.env`

**Interfaces:**
- Consumes: `POST /api/users/me/profile-image-upload-url` body `{ contentType }` → `{ uploadUrl, publicUrl }` (Task 2)
- Consumes: `apiRequest<T>(method, path, body?)` from `frontend/src/services/api.ts`

- [ ] **Step 1: Strip Amplify Storage block from amplify.ts**

Replace the entire content of `frontend/lib/amplify.ts`:

```typescript
import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import AsyncStorage from '@react-native-async-storage/async-storage';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        email: true,
        oauth: {
          domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN!,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: ['onsitemonday://'],
          redirectSignOut: ['onsitemonday://'],
          responseType: 'code',
        },
      },
    },
  },
});

cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);
```

- [ ] **Step 2: Replace imageService.ts with pre-signed URL flow**

Replace the entire content of `frontend/src/services/imageService.ts`:

```typescript
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from './api';

export const CANCELLED = 'cancelled' as const;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

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
  const contentType = asset.mimeType ?? 'image/jpeg';

  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError('Failed to read image file.'));
    xhr.responseType = 'blob';
    xhr.open('GET', asset.uri, true);
    xhr.send(null);
  });

  const { uploadUrl, publicUrl } = await apiRequest<UploadUrlResponse>(
    'POST',
    '/users/me/profile-image-upload-url',
    { contentType }
  );

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Image upload failed (${uploadResponse.status}). Please try again.`);
  }

  return publicUrl;
}
```

- [ ] **Step 3: Remove EXPO_PUBLIC_S3_BUCKET from frontend/.env**

In `frontend/.env`, delete the line:
```
EXPO_PUBLIC_S3_BUCKET=onsite-monday-media
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Restart Metro with cleared cache**

```bash
cd frontend && npx expo start --clear
```

Confirm the app starts without console errors about missing env vars or Amplify Storage.

- [ ] **Step 6: Manual smoke test**

1. Sign in to the app
2. Navigate to profile → tap the profile photo
3. Choose a photo from the library (or take one with camera)
4. Confirm the photo updates in the UI without an error alert

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/amplify.ts \
        frontend/src/services/imageService.ts \
        frontend/.env
git commit -m "feat: switch profile image upload to backend pre-signed URL flow"
```
