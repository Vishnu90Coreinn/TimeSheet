using TimeSheet.Api.Application.Anomaly.Models;
using TimeSheet.Api.Application.Anomaly.Services;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Anomaly;
using TimeSheet.Api.Models;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AnomalyServiceTests
{
    [Fact]
    public async Task Dismiss_ReturnsNotFound_WhenMissing()
    {
        var service = new AnomalyService(new FakeRepo());
        var error = await service.DismissAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.NotNull(error);
        Assert.Equal(404, error!.StatusCode);
    }

    private sealed class FakeRepo : IAnomalyRepository
    {
        public Task<IReadOnlyList<Notification>> GetUnreadAnomaliesAsync(Guid userId, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<Notification>>([]);

        public Task<Notification?> GetAnomalyByIdAsync(Guid userId, Guid id, CancellationToken cancellationToken)
            => Task.FromResult<Notification?>(null);

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
