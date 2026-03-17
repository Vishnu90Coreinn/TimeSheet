using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record StartTimerRequest(
    [Required] Guid ProjectId,
    [Required] Guid CategoryId,
    [MaxLength(500)] string? Note);

public record ConvertTimerRequest(
    [Required] DateOnly WorkDate);

public record TimerSessionResponse(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    Guid CategoryId,
    string CategoryName,
    string? Note,
    string StartedAtUtc,
    string? StoppedAtUtc,
    int? DurationMinutes,
    Guid? ConvertedToEntryId);
