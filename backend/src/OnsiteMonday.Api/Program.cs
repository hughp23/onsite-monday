using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Hubs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Mapping;
using OnsiteMonday.Api.Middleware;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Services.Interfaces;
using OnsiteMonday.Api.Stubs;
using Serilog;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

var useLivePayments = builder.Environment.IsProduction() ||
                      builder.Environment.IsEnvironment("Sandbox");

// Serilog
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console());

// Controllers + SignalR
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddHttpClient("expo-push");
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddDbContextFactory<AppDbContext>(opts =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")), ServiceLifetime.Scoped);

// Cognito JWT Authentication
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
builder.Services.AddAuthorization();

// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

// Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IJobRepository, JobRepository>();
builder.Services.AddScoped<IReviewRepository, ReviewRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IConversationRepository, ConversationRepository>();

// Services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IJobService, JobService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IConversationService, ConversationService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();

// Stripe Connect — use stub in Development/Testing, real service in Production or Sandbox
if (useLivePayments)
    builder.Services.AddScoped<IStripeConnectService, StripeConnectService>();
else
    builder.Services.AddScoped<IStripeConnectService, StubStripeConnectService>();

// Stripe Billing — use stub in Development/Testing, real service in Production or Sandbox
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection("Stripe"));
if (useLivePayments)
{
    Stripe.StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];
    builder.Services.AddScoped<IStripeBillingService, StripeBillingService>();
}
else
{
    builder.Services.AddScoped<IStripeBillingService, StubStripeBillingService>();
}

// Hangfire background jobs (scheduled payout release)
if (useLivePayments)
{
    var connString = builder.Configuration.GetConnectionString("DefaultConnection")!;
    builder.Services.AddHangfire(config => config
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connString)));
    builder.Services.AddHangfireServer();
}
else
{
    // No PostgreSQL in Development/Testing — use stub so DI is satisfied without a running DB
    builder.Services.AddSingleton<IBackgroundJobClient, StubBackgroundJobClient>();
}
builder.Services.AddScoped<IPayoutReleaseJob, PayoutReleaseJob>();
builder.Services.AddScoped<IJobCompletionScanJob, JobCompletionScanJob>();

// Push notifications — stub in Dev, real FCM in Production or Sandbox
if (useLivePayments)
    builder.Services.AddScoped<INotificationPushService, FcmNotificationPushService>();
else
    builder.Services.AddScoped<INotificationPushService, StubNotificationPushService>();
builder.Services.AddScoped<IEmailService, StubEmailService>();

// FluentValidation — validators registered in Phase 3+
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// CORS
builder.Services.AddCors(opts =>
{
    opts.AddPolicy("LocalDev", p =>
        p.WithOrigins(
            "http://localhost:8081",
            "http://localhost:19006",
            "http://localhost:3000")
         .AllowAnyMethod()
         .AllowAnyHeader());
    opts.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin()
         .AllowAnyMethod()
         .AllowAnyHeader());
});

// Trust X-Forwarded-For from AWS ALB so rate limiting partitions on real client IP
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    opts.KnownNetworks.Clear();
    opts.KnownProxies.Clear();
});

// Rate limiting
builder.Services.AddRateLimiter(opts =>
{
    // Global backstop: all endpoints — 300 req/min per IP
    opts.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Public endpoints (health, webhooks): 30 req/min per IP
    opts.AddFixedWindowLimiter("public", o =>
    {
        o.PermitLimit = 30;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });

    // User lookup endpoints: 20 req/min per IP (anti-enumeration)
    opts.AddSlidingWindowLimiter("user-lookup", o =>
    {
        o.PermitLimit = 20;
        o.Window = TimeSpan.FromMinutes(1);
        o.SegmentsPerWindow = 4;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });

    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opts.OnRejected = async (ctx, token) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsync("Rate limit exceeded. Please try again later.", token);
    };
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders();
app.UseCors(app.Environment.IsDevelopment() ? "LocalDev" : "AllowAll");
app.UseRateLimiter();
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
if (useLivePayments)
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new Hangfire.Dashboard.LocalRequestsOnlyAuthorizationFilter() }
    });
    app.MapHangfireDashboard();
    RecurringJob.AddOrUpdate<IJobCompletionScanJob>("job-completion-scan", j => j.ExecuteAsync(), Cron.Daily);
}
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

// Health check (no auth required)
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
   .RequireRateLimiting("public");

// Run migrations and seed on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DataSeeder.SeedAsync(db);
}

await app.RunAsync();

public partial class Program { }
