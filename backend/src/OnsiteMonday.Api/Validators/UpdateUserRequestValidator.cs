using FluentValidation;
using OnsiteMonday.Api.DTOs.Users;

namespace OnsiteMonday.Api.Validators;

public class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        When(x => x.FirstName != null, () =>
            RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100));

        When(x => x.LastName != null, () =>
            RuleFor(x => x.LastName).NotEmpty().MaximumLength(100));

        When(x => x.Phone != null, () =>
            RuleFor(x => x.Phone).Matches(@"^[\d\s\+\-\(\)]{7,20}$")
                .WithMessage("Phone number is not valid."));

        When(x => x.DayRate != null, () =>
            RuleFor(x => x.DayRate).InclusiveBetween(1, 10000)
                .WithMessage("Day rate must be between £1 and £10,000."));

        When(x => x.TravelRadius != null, () =>
            RuleFor(x => x.TravelRadius).InclusiveBetween(1, 200)
                .WithMessage("Travel radius must be between 1 and 200 miles."));
    }
}
