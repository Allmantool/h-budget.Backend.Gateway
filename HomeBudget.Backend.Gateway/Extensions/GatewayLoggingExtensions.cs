using Microsoft.AspNetCore.Builder;
using Serilog;

using HomeBudget.Backend.Gateway.Extensions.Logs;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayLoggingExtensions
{
    public static WebApplicationBuilder AddGatewayLogging(
        this WebApplicationBuilder builder)
    {
        var env = builder.Environment;

        builder.Host.UseSerilog((ctx, cfg) =>
            cfg.ConfigureSerilog(ctx.Configuration, env));

        builder.Configuration.InitializeLogger(
            env,
            builder.Logging,
            builder.Host,
            HostServiceOptions.Gateway);

        return builder;
    }
}
