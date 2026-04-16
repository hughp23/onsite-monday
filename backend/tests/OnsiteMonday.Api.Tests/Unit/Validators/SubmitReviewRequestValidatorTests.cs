using FluentValidation.TestHelper;
using OnsiteMonday.Api.DTOs.Reviews;
using OnsiteMonday.Api.Validators;

namespace OnsiteMonday.Api.Tests.Unit.Validators;

public class SubmitReviewRequestValidatorTests
{
    private readonly SubmitReviewRequestValidator _validator = new();

    private static SubmitReviewRequest MakeValidRequest() => new()
    {
        JobId = Guid.NewGuid(),
        Rating = 4,
        Text = "Excellent work.",
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        _validator.TestValidate(MakeValidRequest()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Rating_WhenZero_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Rating = 0;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Rating);
    }

    [Fact]
    public void Rating_WhenSix_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Rating = 6;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Rating);
    }

    [Fact]
    public void Rating_WhenOne_PassesValidation()
    {
        var req = MakeValidRequest();
        req.Rating = 1;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Rating);
    }

    [Fact]
    public void Rating_WhenFive_PassesValidation()
    {
        var req = MakeValidRequest();
        req.Rating = 5;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Rating);
    }

    [Fact]
    public void JobId_WhenEmpty_FailsWithError()
    {
        var req = MakeValidRequest();
        req.JobId = Guid.Empty;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.JobId);
    }

    [Fact]
    public void Text_WhenNull_PassesValidation()
    {
        var req = MakeValidRequest();
        req.Text = null;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Text);
    }

    [Fact]
    public void Text_WhenTooLong_FailsWithError()
    {
        var req = MakeValidRequest();
        req.Text = new string('X', 2001);
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Text);
    }
}
