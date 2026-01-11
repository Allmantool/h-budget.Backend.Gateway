using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayConfigurationExtensions
{
    public static WebApplicationBuilder AddGatewayConfiguration(
        this WebApplicationBuilder builder)
    {
        var env = builder.Environment;

        builder.Configuration
            .SetBasePath(env.ContentRootPath)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
            .AddJsonFile("ocelot.json", optional: false, reloadOnChange: true)
            .AddJsonFile($"appsettings.{env.EnvironmentName}.json", optional: true)
            .AddJsonFile($"ocelot.{env.EnvironmentName}.json", optional: true)
            .AddEnvironmentVariables();

        if (env.IsDevelopment())
        {
            builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true);
        }

        return builder;
    }
}
