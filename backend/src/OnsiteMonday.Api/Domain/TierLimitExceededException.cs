namespace OnsiteMonday.Api.Domain;

public class TierLimitExceededException : InvalidOperationException
{
    public TierLimitExceededException(string message) : base(message) { }
}
