# Firebase Token Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that Firebase JWT token enforcement is correctly applied to all API endpoints, and fix the test infrastructure so that 401 (Unauthorized) scenarios can actually be tested.

**Architecture:** The production JWT Bearer configuration in `Program.cs` is already correct — it uses Google's OIDC discovery endpoint to validate Firebase-issued tokens. The gap is in the test layer: `FakeAuthHandler` unconditionally authenticates every request, making it impossible to test that protected endpoints actually reject unauthenticated callers. The fix is to make `FakeAuthHandler` conditional on the presence of an `Authorization` header, add a `CreateAuthenticatedClient()` helper, update all existing integration tests to use it, and add explicit auth-enforcement integration tests.

**Tech Stack:** .NET 8, ASP.NET Core JWT Bearer, xunit, FluentAssertions, `Microsoft.AspNetCore.Mvc.Testing`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/FakeAuthHandler.cs` | Make auth conditional on `Authorization` header |
| Modify | `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/TestWebApplicationFactory.cs` | Add `CreateAuthenticatedClient()` helper |
| Create | `backend/tests/OnsiteMonday.Api.Tests/Integration/AuthenticationTests.cs` | Auth-enforcement integration tests |
| Modify | `backend/tests/OnsiteMonday.Api.Tests/Integration/UsersControllerTests.cs` | Switch to `CreateAuthenticatedClient()` |
| Modify | `backend/tests/OnsiteMonday.Api.Tests/Integration/JobsControllerTests.cs` | Switch to `CreateAuthenticatedClient()` |
| Modify | `backend/tests/OnsiteMonday.Api.Tests/Integration/ReviewsControllerTests.cs` | Switch to `CreateAuthenticatedClient()` |
| Modify | `backend/tests/OnsiteMonday.Api.Tests/Integration/NotificationsControllerTests.cs` | Switch to `CreateAuthenticatedClient()` |

---

## Background: What Is Already Correct

`Program.cs` (lines 39–65) already configures Firebase JWT Bearer correctly:

```csharp
opts.Authority = $"https://securetoken.google.com/{firebaseProjectId}";
opts.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer   = true,
    ValidIssuer      = $"https://securetoken.google.com/{firebaseProjectId}",
    ValidateAudience = true,
    ValidAudience    = firebaseProjectId,
    ValidateLifetime = true,
};
```

The middleware pipeline order (`UseAuthentication` before `UseAuthorization`) is correct. All business controllers carry `[Authorize]`. Webhook controllers and the `/api/health` endpoint have no `[Authorize]` and are publicly accessible. **No changes are needed to production code.**

---

### Task 1: Write a failing 401 test

**Files:**
- Create: `backend/tests/OnsiteMonday.Api.Tests/Integration/AuthenticationTests.cs`

- [ ] **Step 1: Create the test file**

```csharp
using System.Net;
using FluentAssertions;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class AuthenticationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public AuthenticationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var client = _factory.CreateUnauthenticatedClient();

        var response = await client.GetAsync("/api/users/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithToken_Returns200Or404()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/users/me");

        // 200 if the user exists in the test DB, 404 if not seeded — either way not 401
        ((int)response.StatusCode).Should().BeOneOf(200, 201, 404);
    }

    [Fact]
    public async Task HealthEndpoint_WithoutToken_Returns200()
    {
        var client = _factory.CreateUnauthenticatedClient();

        var response = await client.GetAsync("/api/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task StripeWebhookEndpoint_WithoutToken_IsNotBlocked()
    {
        // Webhook controllers have no [Authorize] — they use their own signature validation.
        // This confirms the endpoint is reachable without a bearer token.
        // It will return 400 (bad request / missing Stripe signature) not 401.
        var client = _factory.CreateUnauthenticatedClient();

        var response = await client.PostAsync("/api/webhooks/stripe", new StringContent("{}"));

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
    }
}
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd backend
dotnet test tests/OnsiteMonday.Api.Tests \
  --filter "FullyQualifiedName~AuthenticationTests" \
  --logger "console;verbosity=normal"
```

Expected: `ProtectedEndpoint_WithoutToken_Returns401` **FAILS** — receives `200 OK` instead of `401` because `FakeAuthHandler` always authenticates. `CreateAuthenticatedClient` doesn't exist yet so the second test fails to compile.

---

### Task 2: Fix FakeAuthHandler to be header-conditional

**Files:**
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/FakeAuthHandler.cs`

The handler should only authenticate when an `Authorization: Bearer` header is present. Without it, returning `NoResult()` lets ASP.NET Core's authorization middleware produce the correct 401.

- [ ] **Step 1: Replace HandleAuthenticateAsync in FakeAuthHandler**

Replace the entire file with:

```csharp
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace OnsiteMonday.Api.Tests.Infrastructure;

public class FakeAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "FakeAuth";
    public const string TestFirebaseUid = "test-firebase-uid";
    public const string TestEmail = "test@example.com";

    public FakeAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Only authenticate if an Authorization header is present.
        // Returning NoResult() (not Fail()) lets the framework produce a proper 401
        // for [Authorize] endpoints while leaving anonymous endpoints untouched.
        if (!Request.Headers.ContainsKey("Authorization"))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, TestFirebaseUid),
            new Claim(ClaimTypes.Email, TestEmail),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

---

### Task 3: Add CreateAuthenticatedClient to TestWebApplicationFactory

**Files:**
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Infrastructure/TestWebApplicationFactory.cs`

`CreateAuthenticatedClient()` returns a client with `Authorization: Bearer fake-token` set as a default header. The value of the token doesn't matter — `FakeAuthHandler` only checks for the header's presence.

- [ ] **Step 1: Add CreateAuthenticatedClient method**

Add the following method to `TestWebApplicationFactory`, after the existing `CreateUnauthenticatedClient()` method:

```csharp
/// <summary>
/// Creates an HttpClient that includes the fake Authorization header,
/// so FakeAuthHandler authenticates every request as TestFirebaseUid.
/// </summary>
public HttpClient CreateAuthenticatedClient()
{
    var client = CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false,
    });
    client.DefaultRequestHeaders.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "fake-token");
    return client;
}
```

- [ ] **Step 2: Run the auth tests — the compilation error and 401 test should now pass**

```bash
cd backend
dotnet test tests/OnsiteMonday.Api.Tests \
  --filter "FullyQualifiedName~AuthenticationTests" \
  --logger "console;verbosity=normal"
```

Expected: All 4 `AuthenticationTests` **PASS**.

- [ ] **Step 3: Commit FakeAuthHandler + TestWebApplicationFactory changes**

```bash
git add backend/tests/OnsiteMonday.Api.Tests/Infrastructure/FakeAuthHandler.cs
git add backend/tests/OnsiteMonday.Api.Tests/Infrastructure/TestWebApplicationFactory.cs
git add backend/tests/OnsiteMonday.Api.Tests/Integration/AuthenticationTests.cs
git commit -m "test: fix FakeAuthHandler to be header-conditional, add auth enforcement tests"
```

---

### Task 4: Update existing integration tests to use CreateAuthenticatedClient

Now that `FakeAuthHandler` is header-conditional, the existing integration tests that call `factory.CreateClient()` will receive 401s and fail. Switch them to `CreateAuthenticatedClient()`.

**Files:**
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Integration/UsersControllerTests.cs`
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Integration/JobsControllerTests.cs`
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Integration/ReviewsControllerTests.cs`
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Integration/NotificationsControllerTests.cs`

- [ ] **Step 1: Run the full test suite to see which tests now fail**

```bash
cd backend
dotnet test tests/OnsiteMonday.Api.Tests \
  --logger "console;verbosity=normal"
```

Expected: All tests in the 4 existing integration test classes fail with `401 Unauthorized`.

- [ ] **Step 2: Update UsersControllerTests**

In `UsersControllerTests.cs`, find the constructor and change:

```csharp
// BEFORE
_client = factory.CreateClient();
```

```csharp
// AFTER
_client = factory.CreateAuthenticatedClient();
```

- [ ] **Step 3: Update JobsControllerTests**

In `JobsControllerTests.cs`, find the constructor and change:

```csharp
// BEFORE
_client = factory.CreateClient();
```

```csharp
// AFTER
_client = factory.CreateAuthenticatedClient();
```

- [ ] **Step 4: Update ReviewsControllerTests**

In `ReviewsControllerTests.cs`, find the constructor and change:

```csharp
// BEFORE
_client = factory.CreateClient();
```

```csharp
// AFTER
_client = factory.CreateAuthenticatedClient();
```

- [ ] **Step 5: Update NotificationsControllerTests**

In `NotificationsControllerTests.cs`, find the constructor and change:

```csharp
// BEFORE
_client = factory.CreateClient();
```

```csharp
// AFTER
_client = factory.CreateAuthenticatedClient();
```

- [ ] **Step 6: Run the full test suite — all tests should pass**

```bash
cd backend
dotnet test tests/OnsiteMonday.Api.Tests \
  --logger "console;verbosity=normal"
```

Expected: All tests **PASS**, including the 4 new `AuthenticationTests`.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/OnsiteMonday.Api.Tests/Integration/UsersControllerTests.cs
git add backend/tests/OnsiteMonday.Api.Tests/Integration/JobsControllerTests.cs
git add backend/tests/OnsiteMonday.Api.Tests/Integration/ReviewsControllerTests.cs
git add backend/tests/OnsiteMonday.Api.Tests/Integration/NotificationsControllerTests.cs
git commit -m "test: switch integration tests to CreateAuthenticatedClient"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Protected endpoints reject unauthenticated requests (401) | Task 1 + 2 |
| Protected endpoints accept authenticated requests | Task 1 |
| Health endpoint is publicly accessible | Task 1 |
| Webhook endpoints are publicly accessible (no bearer token) | Task 1 |
| Existing integration tests continue to pass | Task 4 |
| FakeAuthHandler correctly identifies test user via claims | Task 2 — claims unchanged, only the guard is new |

### Placeholder Scan

No TBDs or TODOs. All code blocks contain runnable code with exact commands and expected output.

### Type Consistency

- `FakeAuthHandler.TestFirebaseUid` and `FakeAuthHandler.TestEmail` constants are unchanged — all existing references in `TestBuilders` and integration tests remain valid.
- `CreateAuthenticatedClient()` returns `HttpClient` — matches usage in test constructors.
- `AuthenticateResult.NoResult()` — correct API for "I don't know this user" (as opposed to `Fail()` which signals an error).
