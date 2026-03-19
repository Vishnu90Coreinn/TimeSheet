using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Leave.Handlers;

public interface IGetMyLeaveRequestsHandler
{
    Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> HandleAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken);
}

public class GetMyLeaveRequestsHandler(ILeaveService leaveService) : IGetMyLeaveRequestsHandler
{
    public Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> HandleAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken) =>
        leaveService.GetMyLeaveRequestsAsync(userId, query, cancellationToken);
}
