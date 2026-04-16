using FluentValidation;
using OnsiteMonday.Api.DTOs.Jobs;

namespace OnsiteMonday.Api.Validators;

public class CreateJobRequestValidator : AbstractValidator<CreateJobRequest>
{
    public CreateJobRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Trade).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Location).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Postcode).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Duration).GreaterThan(0);
        RuleFor(x => x.Days).NotEmpty().WithMessage("At least one working day is required.");
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("End date must be on or after start date.");
        RuleFor(x => x.StartTime).NotEmpty();
        RuleFor(x => x.EndTime).NotEmpty();
        RuleFor(x => x.DayRate).GreaterThan(0).WithMessage("Day rate must be greater than £0.");
        RuleFor(x => x.PaymentTerms).NotEmpty().MaximumLength(500);
    }
}
