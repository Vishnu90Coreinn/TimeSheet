using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public record GetApprovalHistoryQuery(Guid TimesheetId) : IRequest<Result<List<ApprovalActionResult>>>;
