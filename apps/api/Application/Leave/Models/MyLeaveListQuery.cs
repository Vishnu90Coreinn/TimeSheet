using TimeSheet.Api.Application.Common.Models;

namespace TimeSheet.Api.Application.Leave.Models;

public class MyLeaveListQuery : ListQuery
{
    public string? Status { get; init; }
    public DateOnly? FromDate { get; init; }
    public DateOnly? ToDate { get; init; }
}
