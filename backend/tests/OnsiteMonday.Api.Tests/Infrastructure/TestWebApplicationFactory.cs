using Hangfire;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Tests.Infrastructure;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    // SQLite :memory: with a shared connection so all requests in the test share the same schema.
    // ExecuteUpdateAsync requires a relational provider; InMemory doesn't support it.
    private readonly SqliteConnection _connection;

    public TestWebApplicationFactory()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Using "Testing" environment suppresses DataSeeder (guarded by IsDevelopment())
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Remove Npgsql DbContext registration
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor != null)
                services.Remove(descriptor);

            // Use SQLite :memory: so ExecuteUpdateAsync works (InMemory provider doesn't support it)
            services.AddDbContext<AppDbContext>(opts =>
                opts.UseSqlite(_connection));

            // Remove existing authentication schemes and replace with fake
            var authDescriptors = services
                .Where(d => d.ServiceType == typeof(IAuthenticationSchemeProvider))
                .ToList();

            services
                .AddAuthentication(FakeAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, FakeAuthHandler>(
                    FakeAuthHandler.SchemeName, _ => { });

            // Prevent Hangfire from trying to connect to PostgreSQL in tests.
            // Return a deterministic job ID so tests can assert HangfireJobId is set.
            var bgJobMock = new Mock<IBackgroundJobClient>();
            bgJobMock
                .Setup(m => m.Create(It.IsAny<Hangfire.Common.Job>(), It.IsAny<Hangfire.States.IState>()))
                .Returns("fake-hangfire-job-id");
            services.AddSingleton<IBackgroundJobClient>(bgJobMock.Object);

            // Override IMangopayService with a Moq mock so tests don't need a real Mangopay connection.
            var mangopayMock = new Mock<IMangopayService>();
            mangopayMock.Setup(m => m.EnsureUserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync("stub_mango_user_test");
            mangopayMock.Setup(m => m.EnsureWalletAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync("stub_wallet_test");
            mangopayMock.Setup(m => m.CreateWebPayInAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()))
                .ReturnsAsync(("stub_payin_test", "https://stub-checkout.mangopay.com/pay/test"));
            mangopayMock.Setup(m => m.TransferToTradesPersonWalletAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<decimal>()))
                .ReturnsAsync("stub_transfer_test");
            mangopayMock.Setup(m => m.ReleaseFundsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()))
                .ReturnsAsync("stub_payout_test");
            mangopayMock.Setup(m => m.GetWalletBalanceAsync(It.IsAny<string>()))
                .ReturnsAsync((25000L, 250.00m));
            mangopayMock.Setup(m => m.SubmitKycDocumentAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<string>()))
                .ReturnsAsync("stub_kyc_doc_test");
            mangopayMock.Setup(m => m.CreateBankAccountAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync("stub_bank_test");
            mangopayMock.Setup(m => m.ValidateWebhookSignature(It.IsAny<string>(), It.IsAny<string>()))
                .Returns(true);
            services.AddScoped<IMangopayService>(_ => mangopayMock.Object);
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        // Create the SQLite schema once the host (and thus the DI container) is ready
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _connection.Dispose();
    }

    /// <summary>
    /// Creates an HttpClient that does NOT include the fake auth header,
    /// used to test unauthenticated (401) scenarios.
    /// </summary>
    public HttpClient CreateUnauthenticatedClient()
    {
        return CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
    }

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

    /// <summary>
    /// Seeds data into the shared InMemory database and returns a scoped service provider.
    /// </summary>
    public async Task SeedAsync(Func<AppDbContext, Task> seed)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await seed(db);
    }
}
