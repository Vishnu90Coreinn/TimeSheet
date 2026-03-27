namespace TimeSheet.Api.Dtos;

public record NotificationResponse(
    Guid Id,
    string Title,
    string Message,
    string Type,
    bool IsRead,
    DateTime CreatedAtUtc,
    string? GroupKey = null,
    string? ActionUrl = null);

public record NotificationPageResponse(IReadOnlyList<NotificationResponse> Items, int TotalUnread, bool HasMore);
