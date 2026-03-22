using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Commands;

public record PushBackTimesheetCommand(Guid TimesheetId, string Comment) : IRequest<Result>;
