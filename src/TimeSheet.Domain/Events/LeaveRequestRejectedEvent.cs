using TimeSheet.Domain.Common;

namespace TimeSheet.Domain.Events;

public sealed record LeaveRequestRejectedEvent(
    Guid LeaveRequestId,
    Guid UserId,
    Guid ApproverId,
    DateOnly LeaveDate,
    string? Comment) : IDomainEvent;
