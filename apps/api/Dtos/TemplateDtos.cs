using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record TemplateEntryData(
    [Required] Guid ProjectId,
    [Required] Guid CategoryId,
    [Range(1, 1440)] int Minutes,
    [MaxLength(500)] string? Note);

public record CreateTemplateRequest(
    [Required][MaxLength(120)] string Name,
    [Required] IReadOnlyList<TemplateEntryData> Entries);

public record UpdateTemplateRequest(
    [Required][MaxLength(120)] string Name,
    [Required] IReadOnlyList<TemplateEntryData> Entries);

public record ApplyTemplateRequest([Required] DateOnly WorkDate);

public record TemplateResponse(
    Guid Id,
    string Name,
    DateTime CreatedAtUtc,
    IReadOnlyList<TemplateEntryData> Entries);

public record ApplyTemplateResult(int EntriesCreated, int EntriesSkipped, Guid TimesheetId);
