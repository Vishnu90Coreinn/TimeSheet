using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public record MarkNotificationReadCommand(Guid NotificationId) : IRequest<Result>;
