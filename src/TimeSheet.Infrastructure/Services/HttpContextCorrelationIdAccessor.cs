using Microsoft.AspNetCore.Http;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class HttpContextCorrelationIdAccessor(IHttpContextAccessor httpContextAccessor) : ICorrelationIdAccessor
{
    private const string CorrelationIdHeader = "X-Correlation-ID";

    public string? Current
    {
        get
        {
            var context = httpContextAccessor.HttpContext;
            if (context is null)
            {
                return null;
            }

            if (context.Items.TryGetValue(CorrelationIdHeader, out var value))
            {
                return value?.ToString();
            }

            if (context.Request.Headers.TryGetValue(CorrelationIdHeader, out var headerValue))
            {
                return headerValue.ToString();
            }

            return null;
        }
    }
}
