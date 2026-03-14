using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record UpsertProjectRequest(
    [Required][MaxLength(200)] string Name,
    [Required][MaxLength(50)] string Code,
    bool IsActive
);

public record ProjectResponse(Guid Id, string Name, string Code, bool IsActive, bool IsArchived);

public record AssignProjectMembersRequest([Required] IReadOnlyCollection<Guid> UserIds);

public record ProjectMemberResponse(Guid UserId, string Username, string Email, bool IsActive);
