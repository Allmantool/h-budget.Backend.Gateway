using Microsoft.AspNetCore.Builder;

using HomeBudget.Backend.Gateway.Extensions.Logs;
using HomeBudget.Backend.Gateway.Extensions.OpenTelemetry;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayObservabilityExtensions
{
    public static WebApplicationBuilder AddGatewayObservability(
        this WebApplicationBuilder builder)
    {
        builder.Logging.AddOpenTelemetryMetrics();

        var version =
            typeof(Program).Assembly.GetName().Version?.ToString();

        builder.Services.TryAddTracingSupport(
            builder.Configuration,
            builder.Environment,
            HostServiceOptions.Gateway,
            version);

        return builder;
    }
}
