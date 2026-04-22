using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Hubs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Mapping;
using OnsiteMonday.Api.Middleware;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Stubs;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

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

// Firebase JWT Authentication
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

// Mangopay — use stub in Development/Testing, real service in Production
builder.Services.Configure<MangopayOptions>(builder.Configuration.GetSection("Mangopay"));
if (builder.Environment.IsProduction())
    builder.Services.AddScoped<IMangopayService, MangopayService>();
else
    builder.Services.AddScoped<IMangopayService, StubMangopayService>();

// Stripe Billing — use stub in Development/Testing, real service in Production
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection("Stripe"));
if (builder.Environment.IsProduction())
{
    Stripe.StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];
    builder.Services.AddScoped<IStripeBillingService, StripeBillingService>();
}
else
{
    builder.Services.AddScoped<IStripeBillingService, StubStripeBillingService>();
}

// Hangfire background jobs (scheduled payout release)
if (builder.Environment.IsProduction())
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

// Push notifications — stub in Dev, real FCM in Production
if (builder.Environment.IsProduction())
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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(app.Environment.IsDevelopment() ? "LocalDev" : "AllowAll");
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsProduction())
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new Hangfire.Dashboard.LocalRequestsOnlyAuthorizationFilter() }
    });
    app.MapHangfireDashboard();
}
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

// Health check (no auth required)
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

// Run migrations and seed on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DataSeeder.SeedAsync(db);
}

await app.RunAsync();

public partial class Program { }
