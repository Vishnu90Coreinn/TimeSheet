using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Anomalies.Commands;

public record DismissAnomalyCommand(Guid NotificationId) : IRequest<Result>;
