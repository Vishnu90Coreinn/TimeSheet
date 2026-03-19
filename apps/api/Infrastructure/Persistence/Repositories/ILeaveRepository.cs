using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories;

public interface ILeaveRepository
{
    Task<IReadOnlyList<DateOnly>> GetExistingNonRejectedDatesAsync(Guid userId, IReadOnlyCollection<DateOnly> leaveDates, CancellationToken cancellationToken);
    Task<IReadOnlyList<LeaveRequest>> GetRejectedRequestsForDatesAsync(Guid userId, IReadOnlyCollection<DateOnly> leaveDates, CancellationToken cancellationToken);
    void RemoveLeaveRequests(IEnumerable<LeaveRequest> requests);
    void AddLeaveRequests(IEnumerable<LeaveRequest> requests);
    Task SaveChangesAsync(CancellationToken cancellationToken);
    Task<PagedResult<LeaveRequestResponse>> GetMyLeaveRequestsAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken);
    Task<IReadOnlyList<LeaveRequest>> GetLeaveRequestsForCancellationAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken);
    Task<PagedResult<LeaveRequestResponse>> GetPendingLeaveRequestsAsync(Guid managerId, bool isAdmin, MyLeaveListQuery query, CancellationToken cancellationToken);
    Task<LeaveRequest?> GetLeaveWithUserAsync(Guid leaveRequestId, CancellationToken cancellationToken);
    Task<LeaveRequestResponse?> GetLeaveRequestResponseByIdAsync(Guid leaveRequestId, CancellationToken cancellationToken);

}
