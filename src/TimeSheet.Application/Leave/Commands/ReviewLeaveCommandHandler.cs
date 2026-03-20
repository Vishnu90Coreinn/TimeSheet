using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;


namespace TimeSheet.Application.Leave.Commands;

public class ReviewLeaveCommandHandler(
    ILeaveRepository leaveRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IAuditService auditService,
    INotificationService notificationService)
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

        if (request.Approve)
        {
            leaveRequest.Approve(currentUser.UserId);
            await notificationService.CreateAsync(
                leaveRequest.UserId,
                "Leave Request Updated",
                $"Your leave request for {leaveRequest.LeaveDate:yyyy-MM-dd} has been approved.",
                NotificationType.StatusChange);
        }
        else
        {
            leaveRequest.Reject(currentUser.UserId, request.Comment ?? string.Empty);
            await notificationService.CreateAsync(
                leaveRequest.UserId,
                "Leave Request Updated",
                $"Your leave request for {leaveRequest.LeaveDate:yyyy-MM-dd} has been rejected.",
                NotificationType.StatusChange);
        }

        await auditService.WriteAsync(
            request.Approve ? "LeaveApproved" : "LeaveRejected",
            "LeaveRequest",
            request.LeaveRequestId.ToString(),
            $"Reviewer {currentUser.Username} {(request.Approve ? "approved" : "rejected")} leave for {leaveRequest.LeaveDate:yyyy-MM-dd}",
            currentUser.UserId);

        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}
