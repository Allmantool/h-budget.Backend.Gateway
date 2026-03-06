using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using Ocelot.Middleware;
using Serilog;

namespace HomeBudget.Backend.Gateway.Middlewares
{
    internal class OcelotLoggingMiddleware(RequestDelegate next)
    {
        public async Task InvokeAsync(HttpContext context)
        {
            var downStream = context.Items.DownstreamRoute();

            if (downStream == null)
            {
                await next(context);
                return;
            }

            var request = context.Request;

            var options = new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            };

            Log.Information($"Request: {request.Method} {request.Scheme} {request.Host} {request.Path}");
            Log.Information($"UpstreamPathTemplate: {JsonConvert.SerializeObject(downStream.UpstreamPathTemplate, options)}");
            Log.Information($"DownstreamPathTemplate: {JsonConvert.SerializeObject(downStream.DownstreamPathTemplate, options)}");

            if (downStream.DownstreamPathTemplate?.Value == null || downStream.UpstreamPathTemplate?.OriginalValue == null)
            {
                await next(context);
                return;
            }

            var downstreamPath = downStream.DownstreamPathTemplate.Value;
            var upstreamPath = downStream.UpstreamPathTemplate.OriginalValue;

            if (!string.IsNullOrWhiteSpace(downstreamPath) && !string.IsNullOrWhiteSpace(upstreamPath))
            {
                Log.Information($"Upstream Path: '{upstreamPath}', Downstream Path: '{downstreamPath}'");
            }

            await next(context);
        }
    }
}
