using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Profile.Queries;

public class GetMyProfileQueryHandler(IProfileService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetMyProfileQuery, Result<MyProfileResult>>
{
    public async Task<Result<MyProfileResult>> Handle(GetMyProfileQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<MyProfileResult>.Forbidden("Unauthorized.");

        var profile = await service.GetMyProfileAsync(currentUserService.UserId, cancellationToken);
        return profile is null ? Result<MyProfileResult>.NotFound("Profile not found.") : Result<MyProfileResult>.Success(profile);
    }
}

public class UpdateMyProfileCommandHandler(IProfileService service, ICurrentUserService currentUserService)
    : IRequestHandler<UpdateMyProfileCommand, Result>
{
    public async Task<Result> Handle(UpdateMyProfileCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result.Forbidden("Unauthorized.");
        var outcome = await service.UpdateMyProfileAsync(currentUserService.UserId, request.Username, request.DisplayName, request.Email, request.TimeZoneId, cancellationToken);
        return outcome switch
        {
            ProfileUpdateOutcome.Success => Result.Success(),
            ProfileUpdateOutcome.NotFound => Result.NotFound("Profile not found."),
            ProfileUpdateOutcome.Duplicate => Result.Conflict("Username or email already in use by another account."),
            ProfileUpdateOutcome.InvalidTimeZone => Result.ValidationFailure("Invalid timeZoneId."),
            _ => Result.Failure("Profile update failed.")
        };
    }
}

public class UpdateAvatarCommandHandler(IProfileService service, ICurrentUserService currentUserService)
    : IRequestHandler<UpdateAvatarCommand, Result>
{
    public async Task<Result> Handle(UpdateAvatarCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result.Forbidden("Unauthorized.");
        if (request.AvatarDataUrl is not null && !request.AvatarDataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            return Result.ValidationFailure("Invalid image format.");
        return await service.UpdateAvatarAsync(currentUserService.UserId, request.AvatarDataUrl, cancellationToken)
            ? Result.Success()
            : Result.NotFound("Profile not found.");
    }
}

public class ChangePasswordCommandHandler(IProfileService service, ICurrentUserService currentUserService)
    : IRequestHandler<ChangePasswordCommand, Result>
{
    public async Task<Result> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result.Forbidden("Unauthorized.");
        var outcome = await service.ChangePasswordAsync(currentUserService.UserId, request.CurrentPassword, request.NewPassword, cancellationToken);
        return outcome switch
        {
            PasswordChangeOutcome.Success => Result.Success(),
            PasswordChangeOutcome.NotFound => Result.NotFound("Profile not found."),
            PasswordChangeOutcome.InvalidCurrentPassword => Result.ValidationFailure("Current password is incorrect."),
            _ => Result.Failure("Password change failed.")
        };
    }
}

public class GetNotificationPreferencesQueryHandler(IProfileService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetNotificationPreferencesQuery, Result<NotificationPreferencesResult>>
{
    public async Task<Result<NotificationPreferencesResult>> Handle(GetNotificationPreferencesQuery request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<NotificationPreferencesResult>.Forbidden("Unauthorized.")
            : Result<NotificationPreferencesResult>.Success(await service.GetNotificationPreferencesAsync(currentUserService.UserId, cancellationToken));
}

public class UpdateNotificationPreferencesCommandHandler(IProfileService service, ICurrentUserService currentUserService)
    : IRequestHandler<UpdateNotificationPreferencesCommand, Result>
{
    public async Task<Result> Handle(UpdateNotificationPreferencesCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result.Forbidden("Unauthorized.");
        await service.UpdateNotificationPreferencesAsync(currentUserService.UserId, request.Preferences, cancellationToken);
        return Result.Success();
    }
}
