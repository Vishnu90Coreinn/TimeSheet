using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Anomalies.Queries;

public record GetAnomaliesQuery(string? Severity) : IRequest<Result<IReadOnlyList<AnomalyNotificationResult>>>;
