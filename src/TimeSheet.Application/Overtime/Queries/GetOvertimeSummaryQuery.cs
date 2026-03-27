using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Overtime.Queries;

public record GetOvertimeSummaryQuery(Guid? UserId, DateOnly WeekStart) : IRequest<Result<OvertimeSummaryResult>>;

public record OvertimeSummaryResult(
    Guid UserId,
    DateOnly WeekStart,
    DateOnly WeekEnd,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal CompOffCredits);

