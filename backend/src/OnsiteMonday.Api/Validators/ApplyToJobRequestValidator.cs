using FluentValidation;
using OnsiteMonday.Api.DTOs.Jobs;

namespace OnsiteMonday.Api.Validators;

public class ApplyToJobRequestValidator : AbstractValidator<ApplyToJobRequest>
{
    public ApplyToJobRequestValidator()
    {
        RuleFor(x => x.CoverNote).MaximumLength(1000);
    }
}
