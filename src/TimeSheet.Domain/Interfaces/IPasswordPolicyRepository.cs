using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IPasswordPolicyRepository
{
    Task<PasswordPolicy?> GetAsync(CancellationToken ct);
    Task UpsertAsync(PasswordPolicy policy, CancellationToken ct);
}
