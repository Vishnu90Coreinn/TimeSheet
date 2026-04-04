using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class PasswordPolicyRepository(TimeSheetDbContext context) : IPasswordPolicyRepository
{
    public async Task<PasswordPolicy?> GetAsync(CancellationToken ct)
        => await context.PasswordPolicies.FirstOrDefaultAsync(ct);

    public async Task UpsertAsync(PasswordPolicy policy, CancellationToken ct)
    {
        var existing = await context.PasswordPolicies.FirstOrDefaultAsync(ct);
        if (existing is null)
        {
            if (policy.Id == Guid.Empty)
                policy.Id = Guid.NewGuid();
            await context.PasswordPolicies.AddAsync(policy, ct);
        }
        else
        {
            existing.MinLength = policy.MinLength;
            existing.RequireUppercase = policy.RequireUppercase;
            existing.RequireLowercase = policy.RequireLowercase;
            existing.RequireNumber = policy.RequireNumber;
            existing.RequireSpecialChar = policy.RequireSpecialChar;
            existing.MaxAgeDays = policy.MaxAgeDays;
        }
    }
}
