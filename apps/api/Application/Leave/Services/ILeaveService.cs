using System.Security.Claims;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Leave.Services;

public interface ILeaveService
{
    Task<ApplyLeaveServiceResult> ApplyLeaveAsync(Guid userId, ApplyLeaveRequest request, CancellationToken cancellationToken);
    Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> GetMyLeaveRequestsAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken);
    Task<(bool Success, ServiceError? Error)> CancelLeaveAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken);
    Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> GetPendingLeaveRequestsAsync(Guid managerId, string role, MyLeaveListQuery query, CancellationToken cancellationToken);
    Task<(LeaveRequestResponse? Data, ServiceError? Error)> ReviewLeaveAsync(Guid managerId, string role, Guid leaveRequestId, ReviewLeaveRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken);

}
