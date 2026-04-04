using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Profile.Queries;

public record GetMyProfileQuery : IRequest<Result<MyProfileResult>>;
public record UpdateMyProfileCommand(string Username, string DisplayName, string Email, string TimeZoneId) : IRequest<Result>;
public record UpdateAvatarCommand(string? AvatarDataUrl) : IRequest<Result>;
public record ChangePasswordCommand(string CurrentPassword, string NewPassword) : IRequest<Result>;
public record GetNotificationPreferencesQuery : IRequest<Result<NotificationPreferencesResult>>;
public record UpdateNotificationPreferencesCommand(NotificationPreferencesResult Preferences) : IRequest<Result>;
