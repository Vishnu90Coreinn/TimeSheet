using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class CancelLeaveCommandHandler(
    ILeaveRepository leaveRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<CancelLeaveCommand, Result>
{
    public async Task<Result> Handle(CancelLeaveCommand request, CancellationToken ct)
    {
        var leaveRequests = await leaveRepo.GetByIdOrGroupIdAsync(request.LeaveRequestId, ct);
        if (leaveRequests.Count == 0)
            return Result.NotFound("Leave request not found.");

        if (leaveRequests.Any(lr => lr.UserId != currentUser.UserId) && !currentUser.IsAdmin)
            return Result.Forbidden("You can only cancel your own leave requests.");

        if (leaveRequests.Any(lr => lr.Status == LeaveRequestStatus.Rejected))
            return Result.Conflict("Cannot cancel a rejected leave request.");

        if (leaveRequests.All(lr => lr.Status == LeaveRequestStatus.Cancelled))
            return Result.Conflict("Leave request is already cancelled.");

        foreach (var leaveRequest in leaveRequests.Where(lr => lr.Status != LeaveRequestStatus.Cancelled))
            leaveRequest.Cancel();

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}
