using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetPendingLeaveRequestsQuery(
    string? Search,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<LeaveRequestResult>>>;
