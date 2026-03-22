using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Commands;

public record SubmitWeekCommand(DateOnly WeekStart) : IRequest<Result<SubmitWeekResult>>;

public record SubmitWeekResult(
    IReadOnlyList<string> Submitted,
    IReadOnlyList<SubmitWeekSkipped> Skipped,
    IReadOnlyList<SubmitWeekError> Errors);

public record SubmitWeekSkipped(string Date, string Reason);
public record SubmitWeekError(string Date, string Message);
