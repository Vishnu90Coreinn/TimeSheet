using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetLeaveTypesQuery(bool ActiveOnly = true) : IRequest<Result<List<LeaveTypeResult>>>;
