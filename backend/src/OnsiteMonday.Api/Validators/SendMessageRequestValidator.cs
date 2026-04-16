using FluentValidation;
using OnsiteMonday.Api.DTOs.Conversations;

namespace OnsiteMonday.Api.Validators;

public class SendMessageRequestValidator : AbstractValidator<SendMessageRequest>
{
    public SendMessageRequestValidator()
    {
        RuleFor(x => x.Text).NotEmpty().MaximumLength(5000);
    }
}
