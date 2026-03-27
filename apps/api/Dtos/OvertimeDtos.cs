namespace TimeSheet.Api.Dtos;

public record OvertimeSummaryResponse(
    Guid UserId,
    DateOnly WeekStart,
    DateOnly WeekEnd,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal CompOffCredits);

public record TeamOvertimeSummaryResponse(
    DateOnly WeekStart,
    DateOnly WeekEnd,
    decimal TotalOvertimeHours);

public record CompOffBalanceResponse(decimal Credits, decimal Hours, DateTime? NextExpiryAtUtc);

