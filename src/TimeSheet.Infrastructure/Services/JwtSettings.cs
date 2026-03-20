using Microsoft.Extensions.Configuration;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class JwtSettings(IConfiguration configuration) : IJwtSettings
{
    public int AccessTokenExpiryMinutes =>
        int.TryParse(configuration["Jwt:AccessTokenExpiryMinutes"], out var v) ? v : 60;

    public int RefreshTokenExpiryDays =>
        int.TryParse(configuration["Jwt:RefreshTokenExpiryDays"], out var v) ? v : 14;
}
