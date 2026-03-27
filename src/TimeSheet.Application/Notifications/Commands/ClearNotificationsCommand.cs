using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public record ClearNotificationsCommand : IRequest<Result>;
