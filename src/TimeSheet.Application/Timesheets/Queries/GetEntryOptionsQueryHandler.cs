using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Queries;

public class GetEntryOptionsQueryHandler(
    ITimesheetQueryService timesheetQueryService)
    : IRequestHandler<GetEntryOptionsQuery, Result<EntryOptionsResult>>
{
    public async Task<Result<EntryOptionsResult>> Handle(
        GetEntryOptionsQuery request,
        CancellationToken cancellationToken)
    {
        var result = await timesheetQueryService.GetEntryOptionsAsync(cancellationToken);

        return Result<EntryOptionsResult>.Success(result);
    }
}
