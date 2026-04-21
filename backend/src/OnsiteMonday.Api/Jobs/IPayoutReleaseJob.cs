namespace OnsiteMonday.Api.Jobs;

public interface IPayoutReleaseJob
{
    Task ExecuteAsync(Guid jobId);
}
