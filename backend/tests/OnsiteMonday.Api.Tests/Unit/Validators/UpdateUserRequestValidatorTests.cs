using FluentValidation.TestHelper;
using OnsiteMonday.Api.DTOs.Users;
using OnsiteMonday.Api.Validators;

namespace OnsiteMonday.Api.Tests.Unit.Validators;

public class UpdateUserRequestValidatorTests
{
    private readonly UpdateUserRequestValidator _validator = new();

    [Fact]
    public void EmptyRequest_PassesValidation()
    {
        // All fields are optional; a completely empty request is valid
        _validator.TestValidate(new UpdateUserRequest()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void FirstName_WhenProvidedAndEmpty_FailsWithError()
    {
        var req = new UpdateUserRequest { FirstName = "" };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void FirstName_WhenNull_PassesValidation()
    {
        var req = new UpdateUserRequest { FirstName = null };
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void Phone_WhenProvidedAndInvalid_FailsWithError()
    {
        var req = new UpdateUserRequest { Phone = "not-a-phone" };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Phone);
    }

    [Fact]
    public void Phone_WhenProvidedAndValid_PassesValidation()
    {
        var req = new UpdateUserRequest { Phone = "+44 7700 900000" };
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Phone);
    }

    [Fact]
    public void DayRate_WhenProvidedAndZero_FailsWithError()
    {
        var req = new UpdateUserRequest { DayRate = 0 };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.DayRate);
    }

    [Fact]
    public void DayRate_WhenProvidedAndOverMax_FailsWithError()
    {
        var req = new UpdateUserRequest { DayRate = 10001 };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.DayRate);
    }

    [Fact]
    public void DayRate_WhenProvided_ValidRange_PassesValidation()
    {
        var req = new UpdateUserRequest { DayRate = 500 };
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.DayRate);
    }

    [Fact]
    public void TravelRadius_WhenProvidedAndZero_FailsWithError()
    {
        var req = new UpdateUserRequest { TravelRadius = 0 };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.TravelRadius);
    }

    [Fact]
    public void TravelRadius_WhenProvidedAndOverMax_FailsWithError()
    {
        var req = new UpdateUserRequest { TravelRadius = 201 };
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.TravelRadius);
    }
}
