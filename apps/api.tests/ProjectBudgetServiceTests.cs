using TimeSheet.Api.Application.ProjectBudget.Services;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.ProjectBudget;
using Xunit;

namespace TimeSheet.Api.Tests;

public class ProjectBudgetServiceTests
{
    [Fact]
    public async Task GetBudgetSummary_ReturnsNotFound_WhenProjectMissing()
    {
        var service = new ProjectBudgetService(new FakeRepo());
        var (data, error) = await service.GetBudgetSummaryAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Null(data);
        Assert.NotNull(error);
        Assert.Equal(404, error!.StatusCode);
    }

    private sealed class FakeRepo : IProjectBudgetRepository
    {
        public Task<IReadOnlyList<(Guid Id, string Name, string? Code, double BudgetedHours)>> GetActiveProjectsAsync(CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<(Guid, string, string?, double)>>([]);

        public Task<Dictionary<Guid, long>> GetTotalMinutesByProjectAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken)
            => Task.FromResult(new Dictionary<Guid, long>());

        public Task<(Guid Id, string Name, double BudgetedHours)?> GetProjectForSummaryAsync(Guid id, CancellationToken cancellationToken)
            => Task.FromResult<(Guid, string, double)?>(null);

        public Task<IReadOnlyList<(int Minutes, DateOnly WorkDate)>> GetProjectEntriesForSummaryAsync(Guid projectId, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<(int, DateOnly)>>([]);
    }
}
