using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Queries;

public class GetCurrentUserQueryHandler(
    IUserRepository userRepo,
    ICurrentUserService currentUser)
    : IRequestHandler<GetCurrentUserQuery, Result<CurrentUserResult>>
{
    public async Task<Result<CurrentUserResult>> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;

        var user = await userRepo.GetWithDetailsAsync(userId, cancellationToken);

        if (user is null)
            return Result<CurrentUserResult>.NotFound("User not found.");

        var roleName = user.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault() ?? "employee";

        return Result<CurrentUserResult>.Success(new CurrentUserResult(
            user.Id,
            user.Username,
            user.Email,
            user.EmployeeId,
            roleName,
            user.IsActive,
            user.DepartmentId,
            user.Department?.Name,
            user.WorkPolicyId,
            user.WorkPolicy?.Name,
            user.LeavePolicyId,
            user.LeavePolicy?.Name,
            user.ManagerId,
            user.Manager?.Username,
            user.OnboardingCompletedAt,
            user.LeaveWorkflowVisitedAt));
    }
}
