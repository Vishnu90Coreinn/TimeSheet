namespace TimeSheet.Api.Dtos;

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    Guid UserId,
    string Username,
    string Email,
    string Role
);

public record RefreshTokenRequest(string RefreshToken);
