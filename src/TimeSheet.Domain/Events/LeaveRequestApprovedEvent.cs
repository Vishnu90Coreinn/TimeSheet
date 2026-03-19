using TimeSheet.Domain.Common;

namespace TimeSheet.Domain.Events;

public sealed record LeaveRequestApprovedEvent(
    Guid LeaveRequestId,
    Guid UserId,
    Guid ApproverId,
    DateOnly LeaveDate,
    Guid? LeaveGroupId) : IDomainEvent;
