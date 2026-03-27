using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Overtime.Queries;

public record GetTeamOvertimeSummaryQuery(DateOnly WeekStart) : IRequest<Result<TeamOvertimeSummaryResult>>;

public record TeamOvertimeSummaryResult(DateOnly WeekStart, DateOnly WeekEnd, decimal TotalOvertimeHours);

