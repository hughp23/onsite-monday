using FluentValidation;
using OnsiteMonday.Api.DTOs.Users;

namespace OnsiteMonday.Api.Validators;

public class RegisterBankAccountRequestValidator : AbstractValidator<RegisterBankAccountRequest>
{
    public RegisterBankAccountRequestValidator()
    {
        RuleFor(x => x.SortCode)
            .NotEmpty()
            .Matches(@"^\d{2}-?\d{2}-?\d{2}$")
            .WithMessage("Sort code must be 6 digits, with hyphens optional (e.g. 20-00-00 or 200000).");

        RuleFor(x => x.AccountNumber)
            .NotEmpty()
            .Matches(@"^\d{8}$")
            .WithMessage("Account number must be exactly 8 digits.");

        RuleFor(x => x.HolderName)
            .NotEmpty();
    }
}
