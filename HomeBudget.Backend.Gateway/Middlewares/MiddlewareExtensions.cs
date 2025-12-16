using Microsoft.AspNetCore.Builder;

namespace HomeBudget.Backend.Gateway.Middlewares
{
    internal static class MiddlewareExtensions
    {
        public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<CorrelationIdMiddleware>();
        }
    }
}
