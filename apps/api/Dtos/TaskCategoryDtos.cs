using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record UpsertTaskCategoryRequest([Required][MaxLength(120)] string Name, bool IsActive, bool IsBillable = false);

public record TaskCategoryResponse(Guid Id, string Name, bool IsActive, bool IsBillable);
