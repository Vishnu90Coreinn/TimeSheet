using TimeSheet.Domain.Common;

namespace TimeSheet.Domain.Events;

public sealed record TimesheetSubmittedEvent(
    Guid TimesheetId,
    Guid UserId,
    DateOnly WorkDate) : IDomainEvent;
