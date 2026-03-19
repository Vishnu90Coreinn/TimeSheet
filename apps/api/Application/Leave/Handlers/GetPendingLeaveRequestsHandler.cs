using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Leave.Handlers;

public interface IGetPendingLeaveRequestsHandler
{
    Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> HandleAsync(Guid managerId, string role, MyLeaveListQuery query, CancellationToken cancellationToken);
}

public class GetPendingLeaveRequestsHandler(ILeaveService leaveService) : IGetPendingLeaveRequestsHandler
{
    public Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> HandleAsync(Guid managerId, string role, MyLeaveListQuery query, CancellationToken cancellationToken) =>
        leaveService.GetPendingLeaveRequestsAsync(managerId, role, query, cancellationToken);
}
