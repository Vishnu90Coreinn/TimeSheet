namespace TimeSheet.Api.Dtos;

public record AnomalyNotificationResponse(
    Guid Id,
    string Title,
    string Message,
    string Severity,   // "warning" or "critical"
    string CreatedAtUtc);
