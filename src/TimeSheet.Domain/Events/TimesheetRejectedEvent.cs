using TimeSheet.Domain.Common;

namespace TimeSheet.Domain.Events;

public sealed record TimesheetRejectedEvent(
    Guid TimesheetId,
    Guid UserId,
    Guid ApproverId,
    DateOnly WorkDate,
    string? Comment) : IDomainEvent;
