using System;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Primitives;

using HomeBudget.Backend.Gateway.Constants;

namespace HomeBudget.Backend.Gateway.Middlewares;

internal sealed class ServerSentEventsMiddleware(RequestDelegate next)
{
    private const string EventStreamMediaType = "text/event-stream";
    private const string IdentityEncoding = "identity";
    private const string NoCacheValue = "no-cache, no-store";

    public async Task InvokeAsync(HttpContext context)
    {
        if (!IsServerSentEventsRequest(context.Request))
        {
            await next(context);
            return;
        }

        context.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();
        context.Request.Headers[HttpHeaderKeys.AcceptEncoding] = IdentityEncoding;
        context.Response.Headers[HttpHeaderKeys.CacheControl] = NoCacheValue;
        context.Response.Headers[HttpHeaderKeys.Pragma] = "no-cache";
        context.Response.Headers[HttpHeaderKeys.Expires] = "0";
        context.Response.Headers[HttpHeaderKeys.XAccelBuffering] = "no";

        await next(context);
    }

    internal static bool IsServerSentEventsRequest(HttpRequest request)
    {
        if (!request.Headers.TryGetValue(HttpHeaderKeys.Accept, out StringValues acceptValues))
        {
            return false;
        }

        return acceptValues.Any(static headerValue =>
            headerValue.Contains(EventStreamMediaType, StringComparison.OrdinalIgnoreCase));
    }
}
