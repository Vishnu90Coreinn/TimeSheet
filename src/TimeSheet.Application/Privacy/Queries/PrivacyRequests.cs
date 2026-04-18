using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Privacy.Queries;

public record RequestDataExportQuery : IRequest<Result<ExportRequestResult>>;
public record GetDataExportRequestsQuery : IRequest<Result<IReadOnlyList<ExportRequestResult>>>;
public record DeleteMyAccountCommand : IRequest<Result>;
public record LogConsentCommand(string ConsentType, bool Granted, string? IpAddress) : IRequest<Result>;
