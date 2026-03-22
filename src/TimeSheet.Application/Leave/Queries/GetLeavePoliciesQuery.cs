using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetLeavePoliciesQuery : IRequest<Result<List<LeavePolicyResult>>>;
