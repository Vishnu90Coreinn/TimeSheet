using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetLeaveTypesQueryHandler(
    ILeaveQueryService leaveQuery)
    : IRequestHandler<GetLeaveTypesQuery, Result<List<LeaveTypeResult>>>
{
    public async Task<Result<List<LeaveTypeResult>>> Handle(GetLeaveTypesQuery request, CancellationToken ct)
    {
        var items = await leaveQuery.GetLeaveTypesAsync(request.ActiveOnly, ct);
        return Result<List<LeaveTypeResult>>.Success(items);
    }
}
