using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.PasswordPolicy.Queries;

public class GetPasswordPolicyQueryHandler(IPasswordPolicyRepository policyRepo)
    : IRequestHandler<GetPasswordPolicyQuery, Result<PasswordPolicyResult>>
{
    public async Task<Result<PasswordPolicyResult>> Handle(GetPasswordPolicyQuery request, CancellationToken cancellationToken)
    {
        var policy = await policyRepo.GetAsync(cancellationToken) ?? new Domain.Entities.PasswordPolicy();
        return Result<PasswordPolicyResult>.Success(new PasswordPolicyResult(
            policy.MinLength,
            policy.RequireUppercase,
            policy.RequireLowercase,
            policy.RequireNumber,
            policy.RequireSpecialChar,
            policy.MaxAgeDays));
    }
}
