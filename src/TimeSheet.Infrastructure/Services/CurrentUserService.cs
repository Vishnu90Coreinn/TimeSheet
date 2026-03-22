using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public Guid UserId
    {
        get
        {
            var value = User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User?.FindFirstValue("sub");
            return value is not null ? Guid.Parse(value) : Guid.Empty;
        }
    }

    public string Username => User?.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

    public string Role => User?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public bool IsAdmin => Role.Equals("admin", StringComparison.OrdinalIgnoreCase);

    public bool IsManager => Role.Equals("manager", StringComparison.OrdinalIgnoreCase) || IsAdmin;

    public bool IsManagerOf(Guid subordinateId) => IsManager; // simplified — no org hierarchy lookup needed for Phase 3
}
