using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Services;

namespace TimeSheet.Api.Application.Leave.Handlers;

public interface ICancelLeaveHandler
{
    Task<(bool Success, ServiceError? Error)> HandleAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken);
}

public class CancelLeaveHandler(ILeaveService leaveService) : ICancelLeaveHandler
{
    public Task<(bool Success, ServiceError? Error)> HandleAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken) =>
        leaveService.CancelLeaveAsync(userId, leaveId, cancellationToken);
}
