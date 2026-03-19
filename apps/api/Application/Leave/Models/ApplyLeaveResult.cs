namespace TimeSheet.Api.Application.Leave.Models;

public record ApplyLeaveResult(Guid LeaveGroupId, int Count);

public record ServiceError(string Code, string Message, int StatusCode);

public record ApplyLeaveServiceResult(ApplyLeaveResult? Data, ServiceError? Error)
{
    public bool IsSuccess => Error is null && Data is not null;
}
