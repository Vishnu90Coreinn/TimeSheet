using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Timesheets.Commands;

public class SubmitWeekCommandHandler(
    ITimesheetRepository timesheetRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    ITimesheetQueryService timesheetQuery)
    : IRequestHandler<SubmitWeekCommand, Result<SubmitWeekResult>>
{
    public async Task<Result<SubmitWeekResult>> Handle(SubmitWeekCommand request, CancellationToken ct)
    {
        var userId = currentUser.UserId;

        if (request.WeekStart.DayOfWeek != DayOfWeek.Monday)
            return Result<SubmitWeekResult>.Failure("WeekStart must be a Monday.");

        var backdateLimit = await timesheetQuery.GetBackdateWindowDaysAsync(userId, ct);

        var weekTimesheets = await timesheetRepo.GetByUserAndWeekTrackedAsync(
            userId, request.WeekStart, request.WeekStart.AddDays(6), ct);

        var submitted = new List<string>();
        var skipped = new List<SubmitWeekSkipped>();
        var errors = new List<SubmitWeekError>();

        for (var i = 0; i < 6; i++)
        {
            var day = request.WeekStart.AddDays(i);
            var dateStr = day.ToString("yyyy-MM-dd");

            if (day > dateTimeProvider.TodayUtc)
            {
                skipped.Add(new SubmitWeekSkipped(dateStr, "Future date"));
                continue;
            }

            if (day < dateTimeProvider.TodayUtc.AddDays(-backdateLimit))
            {
                errors.Add(new SubmitWeekError(dateStr, "Outside editing window."));
                continue;
            }

            var timesheet = weekTimesheets.SingleOrDefault(t => t.WorkDate == day);

            if (timesheet is null || timesheet.Entries.Count == 0)
            {
                skipped.Add(new SubmitWeekSkipped(dateStr, "No entries"));
                continue;
            }

            if (timesheet.Status != TimesheetStatus.Draft)
            {
                skipped.Add(new SubmitWeekSkipped(dateStr, $"Already {timesheet.Status.ToString().ToLowerInvariant()}"));
                continue;
            }

            var attendanceNet = await timesheetQuery.GetAttendanceNetMinutesAsync(userId, day, ct);
            var entered = timesheet.Entries.Sum(e => e.Minutes);
            var hasMismatch = attendanceNet != entered;

            timesheet.MismatchReason = hasMismatch ? "(bulk submit)" : null;
            timesheet.Submit();

            submitted.Add(dateStr);
        }

        if (submitted.Count > 0)
            await unitOfWork.SaveChangesAsync(ct);

        return Result<SubmitWeekResult>.Success(new SubmitWeekResult(submitted, skipped, errors));
    }
}
