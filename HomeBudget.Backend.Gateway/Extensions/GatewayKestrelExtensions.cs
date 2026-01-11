using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

using HomeBudget.Backend.Gateway.Infrastructure;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayKestrelExtensions
{
    public static WebApplicationBuilder AddGatewayKestrel(
        this WebApplicationBuilder builder)
    {
        var webHost = builder.WebHost;

        var configurator = new SslKestrelConfigurator();

        webHost.ConfigureKestrel(configurator.Configure);

        return builder;
    }
}
