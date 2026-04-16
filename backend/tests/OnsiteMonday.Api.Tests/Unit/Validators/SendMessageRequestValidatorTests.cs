using FluentValidation.TestHelper;
using OnsiteMonday.Api.DTOs.Conversations;
using OnsiteMonday.Api.Validators;

namespace OnsiteMonday.Api.Tests.Unit.Validators;

public class SendMessageRequestValidatorTests
{
    private readonly SendMessageRequestValidator _validator = new();

    [Fact]
    public void ValidMessage_PassesValidation()
    {
        var req = new SendMessageRequest { Text = "Hello there!" };
        _validator.TestValidate(req).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Text_WhenEmpty_FailsWithError()
    {
        var req = new SendMessageRequest { Text = "" };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Text);
    }

    [Fact]
    public void Text_WhenWhitespaceOnly_FailsWithError()
    {
        var req = new SendMessageRequest { Text = "   " };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Text);
    }

    [Fact]
    public void Text_WhenAtMaxLength_PassesValidation()
    {
        var req = new SendMessageRequest { Text = new string('A', 5000) };
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Text);
    }

    [Fact]
    public void Text_WhenOverMaxLength_FailsWithError()
    {
        var req = new SendMessageRequest { Text = new string('A', 5001) };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Text);
    }
}
