namespace TimeSheet.Application.Anomalies.Queries;

public record AnomalyNotificationResult(
    Guid Id,
    string Title,
    string Message,
    string Severity,
    string CreatedAtUtc);
