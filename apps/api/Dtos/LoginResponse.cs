namespace TimeSheet.Api.Dtos;

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    Guid UserId,
    string Username,
    string Email,
    string Role,
    DateTime? OnboardingCompletedAt,
    DateTime? LeaveWorkflowVisitedAt,
    bool MustChangePassword = false
);

public record RefreshTokenRequest(string RefreshToken);
