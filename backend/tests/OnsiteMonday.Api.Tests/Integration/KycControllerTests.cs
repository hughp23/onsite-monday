using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class KycControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public KycControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                var user = TestBuilders.MakeUser();
                user.MangopayUserId = "stub_mango_user";
                user.MangopayKycStatus = "none";
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
            else
            {
                var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
                user.MangopayUserId = "stub_mango_user";
                user.MangopayKycStatus = "none";
                user.MangopayKycDocumentId = null;
                user.MangopayBankAccountId = null;
                await db.SaveChangesAsync();
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task SubmitKycDocument_Returns202_AndSetsPending()
    {
        using var content = new MultipartFormDataContent();
        var fileBytes = new byte[] { 0xFF, 0xD8, 0xFF }; // minimal JPEG header
        content.Add(new ByteArrayContent(fileBytes), "file", "passport.jpg");

        var response = await _client.PostAsync("/api/kyc/document", content);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.MangopayKycStatus.Should().Be("pending");
            user.MangopayKycDocumentId.Should().NotBeNullOrEmpty();
        });
    }

    [Fact]
    public async Task SubmitKycDocument_NoFile_Returns400()
    {
        var response = await _client.PostAsync("/api/kyc/document", new MultipartFormDataContent());
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RegisterBankAccount_WhenKycNotVerified_Returns400()
    {
        var response = await _client.PutAsJsonAsync("/api/users/me/bank-account",
            new { sortCode = "20-00-00", accountNumber = "55779911", holderName = "James Hartley" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RegisterBankAccount_WhenKycVerified_Returns200_AndSetsBankAccountId()
    {
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.MangopayKycStatus = "verified";
            await db.SaveChangesAsync();
        });

        var response = await _client.PutAsJsonAsync("/api/users/me/bank-account",
            new { sortCode = "20-00-00", accountNumber = "55779911", holderName = "James Hartley" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.MangopayBankAccountId.Should().NotBeNullOrEmpty();
        });
    }
}
