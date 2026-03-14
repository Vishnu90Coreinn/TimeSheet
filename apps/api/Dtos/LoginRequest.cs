using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record LoginRequest(
    [Required] string Identifier,
    [Required][MinLength(6)] string Password
);
