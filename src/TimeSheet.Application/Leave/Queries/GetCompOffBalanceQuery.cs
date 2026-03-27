using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetCompOffBalanceQuery : IRequest<Result<CompOffBalanceResult>>;

public record CompOffBalanceResult(decimal Credits, decimal Hours, DateTime? NextExpiryAtUtc);

