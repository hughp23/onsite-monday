using FluentValidation;
using OnsiteMonday.Api.DTOs.Reviews;

namespace OnsiteMonday.Api.Validators;

public class SubmitReviewRequestValidator : AbstractValidator<SubmitReviewRequest>
{
    public SubmitReviewRequestValidator()
    {
        RuleFor(x => x.Rating).InclusiveBetween(1, 5)
            .WithMessage("Rating must be between 1 and 5.");
        RuleFor(x => x.JobId).NotEmpty();
        When(x => x.Text != null, () =>
            RuleFor(x => x.Text).MaximumLength(2000));
    }
}
