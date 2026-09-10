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
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Services.Interfaces;
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

            // Override IStripeConnectService — tests must not need real Stripe credentials
            var connectMock = new Mock<IStripeConnectService>();
            connectMock
                .Setup(m => m.CreateConnectedAccountAsync(It.IsAny<Guid>(), It.IsAny<string>()))
                .ReturnsAsync("stub_acct_test");
            connectMock
                .Setup(m => m.CreateAccountLinkAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync("https://stub-connect.stripe.com/onboarding/stub_acct_test");
            connectMock
                .Setup(m => m.GetOnboardingCompleteAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            connectMock
                .Setup(m => m.CreateJobCheckoutSessionAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(("stub_cs_test", "https://stub-checkout.stripe.com/pay/stub_cs_test"));
            connectMock
                .Setup(m => m.CreateTransferAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()))
                .ReturnsAsync("stub_tr_test");
            services.AddScoped<IStripeConnectService>(_ => connectMock.Object);

            // Set test Stripe webhook secret so StripeWebhookHelper-signed payloads validate
            services.Configure<StripeOptions>(opts =>
                opts.WebhookSecret = StripeWebhookHelper.TestWebhookSecret);
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
