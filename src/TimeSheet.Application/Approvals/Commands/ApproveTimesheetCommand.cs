using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Commands;

public record ApproveTimesheetCommand(Guid TimesheetId, string? Comment) : IRequest<Result>;
