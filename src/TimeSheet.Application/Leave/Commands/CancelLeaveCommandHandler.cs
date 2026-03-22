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
        var leaveRequest = await leaveRepo.GetByIdAsync(request.LeaveRequestId, ct);
        if (leaveRequest is null)
            return Result.NotFound("Leave request not found.");

        if (leaveRequest.UserId != currentUser.UserId && !currentUser.IsAdmin)
            return Result.Forbidden("You can only cancel your own leave requests.");

        if (leaveRequest.Status == LeaveRequestStatus.Rejected)
            return Result.Conflict("Cannot cancel a rejected leave request.");

        if (leaveRequest.Status == LeaveRequestStatus.Cancelled)
            return Result.Conflict("Leave request is already cancelled.");

        leaveRequest.Cancel();

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}
