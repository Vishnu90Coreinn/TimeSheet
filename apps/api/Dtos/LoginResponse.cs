namespace TimeSheet.Api.Dtos;

public record LoginResponse(string AccessToken, Guid UserId, string Username, string Role);
