using TimeSheet.Domain.Common;

namespace TimeSheet.Domain.Events;

public sealed record TimesheetApprovedEvent(
    Guid TimesheetId,
    Guid UserId,
    Guid ApproverId,
    DateOnly WorkDate) : IDomainEvent;
