using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Users.Queries;

namespace TimeSheet.Application.Users.Commands;

public class GetUserByIdQueryHandler(IUserAdminService service)
    : IRequestHandler<GetUserByIdQuery, Result<UserListItemResult>>
{
    public async Task<Result<UserListItemResult>> Handle(GetUserByIdQuery request, CancellationToken cancellationToken)
    {
        var user = await service.GetByIdAsync(request.UserId, cancellationToken);
        return user is null ? Result<UserListItemResult>.NotFound("User not found.") : Result<UserListItemResult>.Success(user);
    }
}

public class CreateUserCommandHandler(IUserAdminService service)
    : IRequestHandler<CreateUserCommand, Result<UserListItemResult>>
{
    public async Task<Result<UserListItemResult>> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Result<UserListItemResult>.Success(await service.CreateAsync(request, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return Result<UserListItemResult>.Conflict(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Result<UserListItemResult>.ValidationFailure(ex.Message);
        }
    }
}

public class UpdateUserCommandHandler(IUserAdminService service)
    : IRequestHandler<UpdateUserCommand, Result>
{
    public async Task<Result> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
        => UserAdminResultMapper.ToResult(await service.UpdateAsync(request, cancellationToken));
}

public class SetUserManagerCommandHandler(IUserAdminService service, ICurrentUserService currentUserService)
    : IRequestHandler<SetUserManagerCommand, Result>
{
    public async Task<Result> Handle(SetUserManagerCommand request, CancellationToken cancellationToken)
        => UserAdminResultMapper.ToResult(await service.SetManagerAsync(request.UserId, request.ManagerId, currentUserService.UserId, cancellationToken));
}

public class GetUserReporteesQueryHandler(IUserAdminService service)
    : IRequestHandler<GetUserReporteesQuery, Result<IReadOnlyList<UserListItemResult>>>
{
    public async Task<Result<IReadOnlyList<UserListItemResult>>> Handle(GetUserReporteesQuery request, CancellationToken cancellationToken)
        => Result<IReadOnlyList<UserListItemResult>>.Success(await service.GetReporteesAsync(request.UserId, cancellationToken));
}

public class AssignUserRoleCommandHandler(IUserAdminService service, ICurrentUserService currentUserService)
    : IRequestHandler<AssignUserRoleCommand, Result>
{
    public async Task<Result> Handle(AssignUserRoleCommand request, CancellationToken cancellationToken)
        => UserAdminResultMapper.ToResult(await service.AssignRoleAsync(request.UserId, request.RoleName, currentUserService.UserId, cancellationToken));
}

internal static class UserAdminResultMapper
{
    public static Result ToResult(UserUpdateOutcome outcome) => outcome switch
    {
        UserUpdateOutcome.Success => Result.Success(),
        UserUpdateOutcome.NotFound => Result.NotFound("User not found."),
        UserUpdateOutcome.InvalidRole => Result.ValidationFailure("Invalid role."),
        UserUpdateOutcome.Duplicate => Result.Conflict("Username, email, or employee id already exists."),
        UserUpdateOutcome.InvalidManager => Result.ValidationFailure("User cannot be their own manager."),
        UserUpdateOutcome.RoleAlreadyAssigned => Result.Conflict("Role already assigned."),
        _ => Result.Failure("User update failed.")
    };
}
