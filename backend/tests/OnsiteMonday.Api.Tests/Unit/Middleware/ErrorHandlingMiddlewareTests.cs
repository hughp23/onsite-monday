using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using OnsiteMonday.Api.Middleware;

namespace OnsiteMonday.Api.Tests.Unit.Middleware;

public class ErrorHandlingMiddlewareTests
{
    private readonly Mock<ILogger<ErrorHandlingMiddleware>> _loggerMock = new();

    private async Task<DefaultHttpContext> InvokeWithException(Exception? ex = null)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();

        RequestDelegate next = ex == null
            ? _ => Task.CompletedTask
            : _ => Task.FromException(ex);

        var middleware = new ErrorHandlingMiddleware(next, _loggerMock.Object);
        await middleware.InvokeAsync(ctx);
        return ctx;
    }

    private static async Task<string> ReadBodyAsync(HttpResponse response)
    {
        response.Body.Seek(0, SeekOrigin.Begin);
        return await new StreamReader(response.Body).ReadToEndAsync();
    }

    [Fact]
    public async Task KeyNotFoundException_Returns404()
    {
        var ctx = await InvokeWithException(new KeyNotFoundException("not found"));

        ctx.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UnauthorizedAccessException_Returns403()
    {
        var ctx = await InvokeWithException(new UnauthorizedAccessException("forbidden"));

        ctx.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task ArgumentException_Returns400()
    {
        var ctx = await InvokeWithException(new ArgumentException("bad input"));

        ctx.Response.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GenericException_Returns500()
    {
        var ctx = await InvokeWithException(new InvalidOperationException("unexpected"));

        ctx.Response.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task NoException_PassesThrough_StatusUnchanged()
    {
        var ctx = await InvokeWithException(); // no exception

        // Default HttpContext status is 200
        ctx.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GenericException_LogsError()
    {
        await InvokeWithException(new Exception("boom"));

        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task ErrorBody_IsValidJson_WithErrorKey()
    {
        var ctx = await InvokeWithException(new KeyNotFoundException("item missing"));

        var body = await ReadBodyAsync(ctx.Response);
        var doc = JsonDocument.Parse(body);
        doc.RootElement.TryGetProperty("error", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GenericException_BodyContainsGenericMessage()
    {
        var ctx = await InvokeWithException(new Exception("internal details"));

        var body = await ReadBodyAsync(ctx.Response);
        var doc = JsonDocument.Parse(body);
        doc.RootElement.GetProperty("error").GetString()
            .Should().Be("An unexpected error occurred.");
    }
}
