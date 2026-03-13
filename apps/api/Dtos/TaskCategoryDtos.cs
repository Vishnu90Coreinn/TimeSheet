namespace TimeSheet.Api.Dtos;

public record UpsertTaskCategoryRequest(string Name, bool IsActive);

public record TaskCategoryResponse(Guid Id, string Name, bool IsActive);
