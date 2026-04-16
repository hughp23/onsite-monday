using FluentAssertions;
using FluentValidation.TestHelper;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Validators;

namespace OnsiteMonday.Api.Tests.Unit.Validators;

public class CreateJobRequestValidatorTests
{
    private readonly CreateJobRequestValidator _validator = new();

    private static CreateJobRequest MakeValidRequest() => new()
    {
        Title = "Bricklayer needed",
        Trade = "Bricklayer",
        Location = "London",
        Postcode = "EC1A 1BB",
        Duration = 3,
        Days = new List<string> { "Monday", "Tuesday" },
        StartDate = new DateOnly(2026, 5, 1),
        EndDate = new DateOnly(2026, 5, 3),
        StartTime = "08:00",
        EndTime = "17:00",
        DayRate = 300,
        PaymentTerms = "30 days",
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(MakeValidRequest());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Title_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Title = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void Title_WhenTooLong_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Title = new string('A', 201);
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void Trade_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Trade = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Trade);
    }

    [Fact]
    public void Location_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Location = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Location);
    }

    [Fact]
    public void Postcode_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Postcode = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Postcode);
    }

    [Fact]
    public void Duration_WhenZero_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Duration = 0;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Duration);
    }

    [Fact]
    public void Duration_WhenNegative_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Duration = -1;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Duration);
    }

    [Fact]
    public void Days_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Days = new List<string>();
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Days);
    }

    [Fact]
    public void EndDate_WhenBeforeStartDate_FailsWithError()
    {
        var req = MakeValidRequest();
        req.StartDate = new DateOnly(2026, 5, 10);
        req.EndDate = new DateOnly(2026, 5, 9);
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void EndDate_WhenEqualToStartDate_PassesValidation()
    {
        var req = MakeValidRequest();
        req.StartDate = new DateOnly(2026, 5, 10);
        req.EndDate = new DateOnly(2026, 5, 10);
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void DayRate_WhenZero_FailsWithError()
    {
        var req = MakeValidRequest();
        req.DayRate = 0;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DayRate);
    }

    [Fact]
    public void DayRate_WhenNegative_FailsWithError()
    {
        var req = MakeValidRequest();
        req.DayRate = -50;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.DayRate);
    }

    [Fact]
    public void PaymentTerms_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.PaymentTerms = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.PaymentTerms);
    }
}
