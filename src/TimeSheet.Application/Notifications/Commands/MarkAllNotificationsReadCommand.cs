using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public record MarkAllNotificationsReadCommand : IRequest<Result>;
