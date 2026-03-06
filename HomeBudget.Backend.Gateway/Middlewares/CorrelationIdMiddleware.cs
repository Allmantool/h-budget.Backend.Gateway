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

            var traceId = Activity.Current?.TraceId.ToString();

            var correlationId =
                requestHeaders.TryGetValue(HttpHeaderKeys.CorrelationId, out var header)
                    ? header.ToString()
                    : traceId ?? Guid.NewGuid().ToString();

            context.Response.Headers[HttpHeaderKeys.CorrelationId] = correlationId;

            if (traceId != null)
            {
                context.Response.Headers[HttpHeaderKeys.TraceId] = traceId;
            }

            using (LogContext.PushProperty(HttpHeaderKeys.CorrelationId, correlationId))
            using (LogContext.PushProperty(HttpHeaderKeys.TraceId, traceId))
            {
                Log.Information(
                    "Request started {Method} {Path}",
                    context.Request.Method,
                    context.Request.Path);

                await next(context);
            }
        }
    }
}