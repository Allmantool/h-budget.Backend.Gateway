using System;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;

using HomeBudget.Backend.Gateway.Constants;

namespace HomeBudget.Backend.Gateway.Middlewares
{
    internal sealed class HttpsEnforcementMiddleware
    {
        private readonly RequestDelegate _next;

        public HttpsEnforcementMiddleware(RequestDelegate next)
        {
            _next = next ?? throw new ArgumentNullException(nameof(next));
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.IsHttps)
            {
                await _next(context);
                return;
            }

            var path = context.Request.Path;

            if (string.IsNullOrWhiteSpace(path))
            {
                await _next(context);
                return;
            }

            if (path.StartsWithSegments(Endpoints.HealthCheckSource, StringComparison.OrdinalIgnoreCase) ||
                path.StartsWithSegments(Endpoints.HealthCheckUIApiPath, StringComparison.OrdinalIgnoreCase) ||
                path.StartsWithSegments(Endpoints.Metrics, StringComparison.OrdinalIgnoreCase))
            {
                await _next(context);
                return;
            }

            var redirectPath = $"{context.Request.Path}{context.Request.QueryString}";

            context.Response.Redirect(redirectPath, permanent: false);
        }
    }
}
