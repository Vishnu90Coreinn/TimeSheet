using TimeSheet.Domain.Common;

namespace TimeSheet.Domain.Events;

public sealed record WorkSessionCheckedOutEvent(
    Guid WorkSessionId,
    Guid UserId,
    DateTime CheckedOutAtUtc) : IDomainEvent;
