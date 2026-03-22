using MediatR;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Application.Common.Behaviors;

/// <summary>Logs a warning when a request takes longer than the threshold (default 500ms).</summary>
public class PerformanceBehavior<TRequest, TResponse>(
    ILogger<PerformanceBehavior<TRequest, TResponse>> logger,
    ICurrentUserService? currentUser = null)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private const int SlowRequestThresholdMs = 500;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        var response = await next();
        sw.Stop();

        if (sw.ElapsedMilliseconds > SlowRequestThresholdMs)
        {
            logger.LogWarning(
                "Slow request detected: {RequestName} took {ElapsedMs}ms (threshold: {ThresholdMs}ms). User: {UserId}",
                typeof(TRequest).Name,
                sw.ElapsedMilliseconds,
                SlowRequestThresholdMs,
                currentUser?.UserId.ToString() ?? "anonymous");
        }

        return response;
    }
}
