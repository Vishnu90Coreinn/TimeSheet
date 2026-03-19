using System.Security.Claims;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Services;
using TimeSheet.Api.Application.Leave.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;
using Xunit;

namespace TimeSheet.Api.Tests;

public class LeaveServiceTests
{
    [Fact]
    public async Task ApplyLeave_ReturnsError_WhenNoWorkingDaysInRange()
    {
        var repository = new FakeLeaveRepository();
        var service = CreateService(repository);

        var request = new ApplyLeaveRequest(new DateOnly(2026, 3, 21), new DateOnly(2026, 3, 22), Guid.NewGuid(), false, null);
        var result = await service.ApplyLeaveAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.NotNull(result.Error);
        Assert.Equal(400, result.Error!.StatusCode);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task ApplyLeave_SavesRequests_WhenRangeHasWorkingDays()
    {
        var repository = new FakeLeaveRepository();
        var service = CreateService(repository);

        var request = new ApplyLeaveRequest(new DateOnly(2026, 3, 23), new DateOnly(2026, 3, 24), Guid.NewGuid(), false, "Vacation");
        var result = await service.ApplyLeaveAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Data);
        Assert.Equal(2, result.Data!.Count);
        Assert.Equal(1, repository.SaveChangesCallCount);
        Assert.Equal(2, repository.AddedRequests.Count);
    }

    [Fact]
    public async Task CancelLeave_ReturnsNotFound_WhenNoMatchingRequests()
    {
        var repository = new FakeLeaveRepository();
        var service = CreateService(repository);

        var (success, error) = await service.CancelLeaveAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(success);
        Assert.NotNull(error);
        Assert.Equal(404, error!.StatusCode);
    }

    private static LeaveService CreateService(FakeLeaveRepository repository)
        => new(repository, new ApplyLeaveValidator(), new MyLeaveListQueryValidator(), new FakeAuditService(), new FakeNotificationService());

    private sealed class FakeLeaveRepository : ILeaveRepository
    {
        public List<LeaveRequest> AddedRequests { get; } = [];
        public int SaveChangesCallCount { get; private set; }

        public Task<IReadOnlyList<DateOnly>> GetExistingNonRejectedDatesAsync(Guid userId, IReadOnlyCollection<DateOnly> leaveDates, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<DateOnly>>([]);

        public Task<IReadOnlyList<LeaveRequest>> GetRejectedRequestsForDatesAsync(Guid userId, IReadOnlyCollection<DateOnly> leaveDates, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<LeaveRequest>>([]);

        public void RemoveLeaveRequests(IEnumerable<LeaveRequest> requests)
        {
        }

        public void AddLeaveRequests(IEnumerable<LeaveRequest> requests)
        {
            AddedRequests.AddRange(requests);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCallCount++;
            return Task.CompletedTask;
        }

        public Task<TimeSheet.Api.Application.Common.Models.PagedResult<LeaveRequestResponse>> GetMyLeaveRequestsAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken)
            => throw new NotImplementedException();

        public Task<IReadOnlyList<LeaveRequest>> GetLeaveRequestsForCancellationAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<LeaveRequest>>([]);

        public Task<TimeSheet.Api.Application.Common.Models.PagedResult<LeaveRequestResponse>> GetPendingLeaveRequestsAsync(Guid managerId, bool isAdmin, MyLeaveListQuery query, CancellationToken cancellationToken)
            => throw new NotImplementedException();

        public Task<LeaveRequest?> GetLeaveWithUserAsync(Guid leaveRequestId, CancellationToken cancellationToken)
            => Task.FromResult<LeaveRequest?>(null);

        public Task<LeaveRequestResponse?> GetLeaveRequestResponseByIdAsync(Guid leaveRequestId, CancellationToken cancellationToken)
            => Task.FromResult<LeaveRequestResponse?>(null);
    }

    private sealed class FakeAuditService : IAuditService
    {
        public Task WriteAsync(string action, string entityType, string entityId, string? details, ClaimsPrincipal? user = null) => Task.CompletedTask;
    }

    private sealed class FakeNotificationService : INotificationService
    {
        public Task CreateAsync(Guid userId, string title, string message, NotificationType type, Guid? relatedEntityId = null) => Task.CompletedTask;

        public Task CreateForUsersAsync(IEnumerable<Guid> userIds, string title, string message, NotificationType type, Guid? relatedEntityId = null) => Task.CompletedTask;

        public Task<int> DispatchScheduledDigestsAsync(CancellationToken ct = default) => Task.FromResult(0);
    }
}
