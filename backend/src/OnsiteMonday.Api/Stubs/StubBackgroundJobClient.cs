using Hangfire;
using Hangfire.Common;
using Hangfire.States;

namespace OnsiteMonday.Api.Stubs;

internal sealed class StubBackgroundJobClient : IBackgroundJobClient
{
    public string Create(Job job, IState state) => Guid.NewGuid().ToString();
    public bool ChangeState(string jobId, IState state, string expectedState) => true;
}
