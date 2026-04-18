namespace TimeSheet.Application.Common;

public static class PasswordValidator
{
    public static string[] Validate(string password, TimeSheet.Domain.Entities.PasswordPolicy policy)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(password) || password.Length < policy.MinLength)
            errors.Add($"Password must be at least {policy.MinLength} characters.");

        if (policy.RequireUppercase && !password.Any(char.IsUpper))
            errors.Add("Password must contain at least one uppercase letter.");

        if (policy.RequireLowercase && !password.Any(char.IsLower))
            errors.Add("Password must contain at least one lowercase letter.");

        if (policy.RequireNumber && !password.Any(char.IsDigit))
            errors.Add("Password must contain at least one number.");

        if (policy.RequireSpecialChar && !password.Any(c => !char.IsLetterOrDigit(c)))
            errors.Add("Password must contain at least one special character.");

        return errors.ToArray();
    }
}
