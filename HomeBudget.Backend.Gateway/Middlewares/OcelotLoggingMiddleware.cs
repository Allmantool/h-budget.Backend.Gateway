using System;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;

using Ocelot.Middleware;

namespace HomeBudget.Backend.Gateway.Middlewares
{
    public class OcelotLoggingMiddleware(RequestDelegate next)
    {
        public async Task InvokeAsync(HttpContext context)
        {
            var downStream = context.Items.DownstreamRoute();

            if (downStream?.DownstreamPathTemplate?.Value == null || downStream.UpstreamPathTemplate?.OriginalValue == null)
            {
                await next(context);
                return;
            }

            var downstreamPath = downStream.DownstreamPathTemplate.Value;
            var upstreamPath = downStream.UpstreamPathTemplate.OriginalValue;

            if (!string.IsNullOrWhiteSpace(downstreamPath) && !string.IsNullOrWhiteSpace(upstreamPath))
            {
                Console.WriteLine($"Upstream Path: '{upstreamPath}', Downstream Path: '{downstreamPath}'");
            }

            await next(context);
        }
    }
}
