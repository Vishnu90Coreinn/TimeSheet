using System.Security.Claims;
using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Leave.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Application.Leave.Services;

public class LeaveService(
    ILeaveRepository leaveRepository,
    IApplyLeaveValidator applyLeaveValidator,
    IMyLeaveListQueryValidator myLeaveListQueryValidator,
    IAuditService auditService,
    INotificationService notificationService) : ILeaveService
{
    public async Task<ApplyLeaveServiceResult> ApplyLeaveAsync(Guid userId, ApplyLeaveRequest request, CancellationToken cancellationToken)
    {
        var validationError = applyLeaveValidator.Validate(request);
        if (validationError is not null)
        {
            return new ApplyLeaveServiceResult(null, validationError);
        }

        var workingDays = GetWorkingDays(request.FromDate, request.ToDate);
        if (workingDays.Count == 0)
        {
            return new ApplyLeaveServiceResult(null, new ServiceError(ErrorCodes.NoWorkingDays, ApiMessages.LeaveNoWorkingDays, StatusCodes.Status400BadRequest));
        }

        var existingDates = await leaveRepository.GetExistingNonRejectedDatesAsync(userId, workingDays, cancellationToken);
        if (existingDates.Count > 0)
        {
            var orderedExistingDates = existingDates.OrderBy(x => x).Select(x => x.ToString("MMM d"));
            return new ApplyLeaveServiceResult(null, new ServiceError(
                ErrorCodes.DuplicateDates,
                string.Format(ApiMessages.LeaveOverlapsExisting, string.Join(", ", orderedExistingDates)),
                StatusCodes.Status409Conflict));
        }

        var rejectedToReplace = await leaveRepository.GetRejectedRequestsForDatesAsync(userId, workingDays, cancellationToken);
        if (rejectedToReplace.Count > 0)
        {
            leaveRepository.RemoveLeaveRequests(rejectedToReplace);
        }

        var leaveGroupId = Guid.NewGuid();
        var utcNow = DateTime.UtcNow;
        var leaveRequests = workingDays.Select(day => new LeaveRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            LeaveTypeId = request.LeaveTypeId,
            LeaveDate = day,
            IsHalfDay = request.IsHalfDay,
            Comment = request.Comment,
            Status = LeaveRequestStatus.Pending,
            LeaveGroupId = leaveGroupId,
            CreatedAtUtc = utcNow
        }).ToList();

        leaveRepository.AddLeaveRequests(leaveRequests);
        await leaveRepository.SaveChangesAsync(cancellationToken);

        return new ApplyLeaveServiceResult(new ApplyLeaveResult(leaveGroupId, leaveRequests.Count), null);
    }

    public async Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> GetMyLeaveRequestsAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken)
    {
        var validationError = myLeaveListQueryValidator.Validate(query);
        if (validationError is not null)
        {
            return (null, validationError);
        }

        var result = await leaveRepository.GetMyLeaveRequestsAsync(userId, query, cancellationToken);
        return (result, null);
    }

    public async Task<(bool Success, ServiceError? Error)> CancelLeaveAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken)
    {
        var requests = await leaveRepository.GetLeaveRequestsForCancellationAsync(userId, leaveId, cancellationToken);
        if (requests.Count == 0)
        {
            return (false, new ServiceError(ErrorCodes.LeaveNotFound, ApiMessages.LeaveRequestNotFound, StatusCodes.Status404NotFound));
        }

        if (requests.Any(lr => lr.Status != LeaveRequestStatus.Pending))
        {
            return (false, new ServiceError(ErrorCodes.LeaveCancelInvalidStatus, ApiMessages.LeaveCancelPendingOnly, StatusCodes.Status409Conflict));
        }

        leaveRepository.RemoveLeaveRequests(requests);
        await leaveRepository.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(PagedResult<LeaveRequestResponse>? Data, ServiceError? Error)> GetPendingLeaveRequestsAsync(Guid managerId, string role, MyLeaveListQuery query, CancellationToken cancellationToken)
    {
        var validationError = myLeaveListQueryValidator.Validate(query);
        if (validationError is not null)
        {
            return (null, validationError);
        }

        var isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
        var result = await leaveRepository.GetPendingLeaveRequestsAsync(managerId, isAdmin, query, cancellationToken);
        return (result, null);
    }

    public async Task<(LeaveRequestResponse? Data, ServiceError? Error)> ReviewLeaveAsync(Guid managerId, string role, Guid leaveRequestId, ReviewLeaveRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var leave = await leaveRepository.GetLeaveWithUserAsync(leaveRequestId, cancellationToken);
        if (leave is null)
        {
            return (null, new ServiceError(ErrorCodes.LeaveNotFound, ApiMessages.LeaveRequestNotFound, StatusCodes.Status404NotFound));
        }

        if (leave.Status != LeaveRequestStatus.Pending)
        {
            return (null, new ServiceError(ErrorCodes.LeaveReviewInvalidStatus, ApiMessages.LeaveReviewPendingOnly, StatusCodes.Status409Conflict));
        }

        var isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin && leave.User.ManagerId != managerId)
        {
            return (null, new ServiceError(ErrorCodes.LeaveReviewForbidden, ApiMessages.LeaveReviewForbidden, StatusCodes.Status403Forbidden));
        }

        if (!request.Approve && string.IsNullOrWhiteSpace(request.Comment))
        {
            return (null, new ServiceError(ErrorCodes.LeaveRejectionCommentRequired, ApiMessages.LeaveRejectionCommentRequired, StatusCodes.Status400BadRequest));
        }

        leave.Status = request.Approve ? LeaveRequestStatus.Approved : LeaveRequestStatus.Rejected;
        leave.ReviewedByUserId = managerId;
        leave.ReviewerComment = request.Comment?.Trim();
        leave.ReviewedAtUtc = DateTime.UtcNow;

        await leaveRepository.SaveChangesAsync(cancellationToken);
        await auditService.WriteAsync(request.Approve ? "LeaveApproved" : "LeaveRejected", "LeaveRequest", leave.Id.ToString(), string.Format(ApiMessages.LeaveReviewAuditMessage, leave.LeaveDate), principal);
        await notificationService.CreateAsync(leave.UserId, ApiMessages.LeaveReviewNotificationTitle, string.Format(ApiMessages.LeaveReviewNotificationMessage, leave.LeaveDate, request.Approve ? "approved" : "rejected"), NotificationType.StatusChange);
        await leaveRepository.SaveChangesAsync(cancellationToken);

        var response = await leaveRepository.GetLeaveRequestResponseByIdAsync(leave.Id, cancellationToken);
        return (response, null);
    }

    private static List<DateOnly> GetWorkingDays(DateOnly fromDate, DateOnly toDate)
    {
        var workingDays = new List<DateOnly>();
        for (var currentDate = fromDate; currentDate <= toDate; currentDate = currentDate.AddDays(1))
        {
            if (currentDate.DayOfWeek != DayOfWeek.Saturday && currentDate.DayOfWeek != DayOfWeek.Sunday)
            {
                workingDays.Add(currentDate);
            }
        }

        return workingDays;
    }
}
