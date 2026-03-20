using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Timesheets.Commands;

public class DeleteTimesheetEntryCommandHandler(
    ITimesheetQueryService timesheetQuery,
    ITimesheetRepository timesheetRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    IAuditService auditService)
    : IRequestHandler<DeleteTimesheetEntryCommand, Result<TimesheetDayResult>>
{
    public async Task<Result<TimesheetDayResult>> Handle(
        DeleteTimesheetEntryCommand request,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;

        var timesheet = await timesheetRepo.GetByUserAndDateAsync(userId, request.WorkDate, ct);
        if (timesheet is null)
            return Result<TimesheetDayResult>.NotFound("Timesheet not found.");

        var entry = timesheet.Entries.FirstOrDefault(e => e.Id == request.EntryId);
        if (entry is null)
            return Result<TimesheetDayResult>.NotFound("Entry not found.");

        // Validate edit window
        var today = dateTimeProvider.TodayUtc;
        if (request.WorkDate > today)
            return Result<TimesheetDayResult>.Failure("Future dates are not allowed.");

        var backdateDays = await timesheetQuery.GetBackdateWindowDaysAsync(userId, ct);
        if (request.WorkDate < today.AddDays(-backdateDays))
            return Result<TimesheetDayResult>.Failure($"Editing window is limited to {backdateDays} day(s).");

        if (timesheet.Status != TimesheetStatus.Draft)
            return Result<TimesheetDayResult>.Conflict("Only draft timesheets can be edited.");

        timesheet.Entries.Remove(entry);

        await auditService.WriteAsync(
            "TimesheetEntryDeleted",
            "TimesheetEntry",
            request.EntryId.ToString(),
            $"Entry deleted for {request.WorkDate}",
            userId);

        await unitOfWork.SaveChangesAsync(ct);

        var day = await timesheetQuery.GetDayAsync(userId, request.WorkDate, ct);
        return Result<TimesheetDayResult>.Success(day!);
    }
}
