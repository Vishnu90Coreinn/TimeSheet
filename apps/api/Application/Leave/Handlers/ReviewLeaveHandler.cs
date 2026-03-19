using System.Security.Claims;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Leave.Handlers;

public interface IReviewLeaveHandler
{
    Task<(LeaveRequestResponse? Data, ServiceError? Error)> HandleAsync(Guid managerId, string role, Guid leaveRequestId, ReviewLeaveRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken);
}

public class ReviewLeaveHandler(ILeaveService leaveService) : IReviewLeaveHandler
{
    public Task<(LeaveRequestResponse? Data, ServiceError? Error)> HandleAsync(Guid managerId, string role, Guid leaveRequestId, ReviewLeaveRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken) =>
        leaveService.ReviewLeaveAsync(managerId, role, leaveRequestId, request, principal, cancellationToken);
}
