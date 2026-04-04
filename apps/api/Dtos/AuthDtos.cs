namespace TimeSheet.Api.Dtos;

public record GetSecurityQuestionResponse(string Question);
public record VerifySecurityAnswerRequest(string Username, string Answer);
public record VerifySecurityAnswerResponse(string ResetToken, string ExpiresAt);
public record ResetPasswordRequest(string ResetToken, string NewPassword);
public record SetSecurityQuestionRequest(string Question, string Answer, string CurrentPassword);
public record SecurityQuestionStatusResponse(bool HasQuestion, string? Question);
public record PasswordPolicyResponse(
    int MinLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireNumber,
    bool RequireSpecialChar,
    int MaxAgeDays);
public record UpdatePasswordPolicyRequest(
    int MinLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireNumber,
    bool RequireSpecialChar,
    int MaxAgeDays);
