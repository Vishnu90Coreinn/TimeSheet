using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Push.Queries;

public record GetVapidKeyQuery : IRequest<Result<string>>;
public record SubscribePushCommand(string Endpoint, string P256dh, string Auth) : IRequest<Result>;
public record UnsubscribePushCommand(string Endpoint) : IRequest<Result>;
