using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Leave.Handlers;

public interface IApplyLeaveHandler
{
    Task<ApplyLeaveServiceResult> HandleAsync(Guid userId, ApplyLeaveRequest request, CancellationToken cancellationToken);
}

public class ApplyLeaveHandler(ILeaveService leaveService) : IApplyLeaveHandler
{
    public Task<ApplyLeaveServiceResult> HandleAsync(Guid userId, ApplyLeaveRequest request, CancellationToken cancellationToken) =>
        leaveService.ApplyLeaveAsync(userId, request, cancellationToken);
}
