namespace TimeSheet.Application.Privacy.Queries;

public record ExportRequestResult(Guid Id, string Status, DateTime RequestedAt, DateTime? CompletedAt, string? DownloadUrl);
