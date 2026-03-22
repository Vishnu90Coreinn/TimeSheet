namespace TimeSheet.Application.Common.Interfaces;

public interface IJwtSettings
{
    int AccessTokenExpiryMinutes { get; }
    int RefreshTokenExpiryDays { get; }
}
