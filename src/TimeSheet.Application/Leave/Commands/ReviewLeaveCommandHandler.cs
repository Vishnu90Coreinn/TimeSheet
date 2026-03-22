using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;


namespace TimeSheet.Application.Leave.Commands;

public class ReviewLeaveCommandHandler(
    ILeaveRepository leaveRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<ReviewLeaveCommand, Result>
{
    public async Task<Result> Handle(ReviewLeaveCommand request, CancellationToken ct)
    {
        var leaveRequest = await leaveRepo.GetByIdAsync(request.LeaveRequestId, ct);
        if (leaveRequest is null)
            return Result.NotFound("Leave request not found.");

        if (leaveRequest.Status != LeaveRequestStatus.Pending)
            return Result.Conflict("Only pending leave requests can be reviewed.");

        if (!currentUser.IsAdmin && !currentUser.IsManager)
            return Result.Forbidden("Only managers or admins can review leave requests.");

        if (!currentUser.IsAdmin && !currentUser.IsManagerOf(leaveRequest.UserId))
            return Result.Forbidden("You can only review leave requests for your direct reports.");

        if (request.Approve)
        {
            leaveRequest.Approve(currentUser.UserId);
        }
        else
        {
            leaveRequest.Reject(currentUser.UserId, request.Comment ?? string.Empty);
        }

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}
