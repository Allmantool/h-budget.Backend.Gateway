using System;
using System.Diagnostics;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;
using Serilog;
using Serilog.Context;

using HomeBudget.Backend.Gateway.Constants;

namespace HomeBudget.Backend.Gateway.Middlewares
{
    internal class CorrelationIdMiddleware(RequestDelegate next)
    {
        public async Task InvokeAsync(HttpContext context)
        {
            var requestHeaders = context.Request.Headers;

            string correlationId;

            if (requestHeaders.TryGetValue(HttpHeaderKeys.CorrelationId, out var headerValue))
            {
                correlationId = headerValue.ToString();
            }
            else
            {
                correlationId = Guid.NewGuid().ToString();
            }

            context.Response.Headers[HttpHeaderKeys.CorrelationId] = correlationId;

            var traceId = Activity.Current?.TraceId.ToString();

            context.Response.Headers[HttpHeaderKeys.TraceId] = traceId;

            using (LogContext.PushProperty(HttpHeaderKeys.CorrelationId, correlationId))
            using (LogContext.PushProperty(HttpHeaderKeys.TraceId, traceId))
            {
                Log.Information(
                    "Request started {Method} {Path}",
                    context.Request.Method,
                    context.Request.Path);

                await next.Invoke(context);
            }
        }
    }
}