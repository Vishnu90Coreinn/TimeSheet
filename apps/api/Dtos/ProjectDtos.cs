namespace TimeSheet.Api.Dtos;

public record UpsertProjectRequest(string Name, string Code, bool IsActive);

public record ProjectResponse(Guid Id, string Name, string Code, bool IsActive, bool IsArchived);
