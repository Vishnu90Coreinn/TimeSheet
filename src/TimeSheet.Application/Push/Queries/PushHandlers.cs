using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Push.Queries;

public class GetVapidKeyQueryHandler(IPushService service)
    : IRequestHandler<GetVapidKeyQuery, Result<string>>
{
    public Task<Result<string>> Handle(GetVapidKeyQuery request, CancellationToken cancellationToken)
        => Task.FromResult(Result<string>.Success(service.GetVapidPublicKey()));
}

public class SubscribePushCommandHandler(IPushService service, ICurrentUserService currentUserService)
    : IRequestHandler<SubscribePushCommand, Result>
{
    public async Task<Result> Handle(SubscribePushCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result.Forbidden("Unauthorized.");
        await service.SubscribeAsync(currentUserService.UserId, request.Endpoint, request.P256dh, request.Auth, cancellationToken);
        return Result.Success();
    }
}

public class UnsubscribePushCommandHandler(IPushService service)
    : IRequestHandler<UnsubscribePushCommand, Result>
{
    public async Task<Result> Handle(UnsubscribePushCommand request, CancellationToken cancellationToken)
    {
        await service.UnsubscribeAsync(request.Endpoint, cancellationToken);
        return Result.Success();
    }
}
