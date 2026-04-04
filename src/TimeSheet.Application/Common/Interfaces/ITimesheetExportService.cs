using TimeSheet.Application.TimesheetExports.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface ITimesheetExportService
{
    Task<IReadOnlyList<TimesheetExportUserResult>> GetExportableUsersAsync(Guid callerId, string role, CancellationToken ct = default);
    Task<TimesheetExportDataResult> BuildExportAsync(Guid callerId, string role, DateOnly fromDate, DateOnly toDate, Guid? userId, IReadOnlyList<Guid>? userIds, CancellationToken ct = default);
}
