namespace TimeSheet.Api.Dtos;

public record NotificationResponse(Guid Id, string Title, string Message, string Type, bool IsRead, DateTime CreatedAtUtc);
