using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Timesheets.Commands;

public class SubmitTimesheetCommandHandler(
    ITimesheetQueryService timesheetQuery,
    ITimesheetRepository timesheetRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    IAuditService auditService)
    : IRequestHandler<SubmitTimesheetCommand, Result<TimesheetDayResult>>
{
    public async Task<Result<TimesheetDayResult>> Handle(
        SubmitTimesheetCommand request,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;

        // Active user guard
        var isActive = await timesheetQuery.IsActiveUserAsync(userId, ct);
        if (isActive is null) return Result<TimesheetDayResult>.NotFound("User not found.");
        if (isActive is false) return Result<TimesheetDayResult>.Forbidden("Inactive users cannot submit timesheets.");

        // Validate edit window
        var today = dateTimeProvider.TodayUtc;
        if (request.WorkDate > today)
            return Result<TimesheetDayResult>.Failure("Future dates are not allowed.");

        var backdateDays = await timesheetQuery.GetBackdateWindowDaysAsync(userId, ct);
        if (request.WorkDate < today.AddDays(-backdateDays))
            return Result<TimesheetDayResult>.Failure($"Editing window is limited to {backdateDays} day(s).");

        var timesheet = await timesheetRepo.GetByUserAndDateAsync(userId, request.WorkDate, ct);
        if (timesheet is null)
            return Result<TimesheetDayResult>.Failure("No timesheet exists for this date.");

        if (timesheet.Status != TimesheetStatus.Draft)
            return Result<TimesheetDayResult>.Conflict("Only draft timesheets can be submitted.");

        var attendanceNet = await timesheetQuery.GetAttendanceNetMinutesAsync(userId, request.WorkDate, ct);
        var entered = timesheet.Entries.Sum(e => e.Minutes);
        var hasMismatch = attendanceNet != entered;

        var requiresReason = await timesheetQuery.RequiresMismatchReasonAsync(userId, ct);
        if (hasMismatch && requiresReason && string.IsNullOrWhiteSpace(request.MismatchReason))
            return Result<TimesheetDayResult>.Failure("Mismatch reason is required.");

        // Set submission fields manually (domain Submit() doesn't accept notes/mismatchReason params)
        timesheet.SubmissionNotes = request.Notes;
        timesheet.MismatchReason = hasMismatch ? request.MismatchReason?.Trim() : null;
        timesheet.Submit();

        await auditService.WriteAsync(
            "TimesheetSubmitted",
            "Timesheet",
            timesheet.Id.ToString(),
            $"Submitted timesheet for {request.WorkDate}",
            userId);

        await unitOfWork.SaveChangesAsync(ct);

        var day = await timesheetQuery.GetDayAsync(userId, request.WorkDate, ct);
        return Result<TimesheetDayResult>.Success(day!);
    }
}
