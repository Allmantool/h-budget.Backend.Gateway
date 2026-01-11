using System;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;
using Ocelot.DependencyInjection;

using HomeBudget.Backend.Gateway.Configuration;
using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayServiceExtensions
{
    public static WebApplicationBuilder AddGatewayServices(
        this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        services.AddControllers();
        services.AddOcelot(configuration);

        services.AddEndpointsApiExplorer()
            .SetUpHealthCheck(
                configuration,
                Environment.GetEnvironmentVariable("ASPNETCORE_URLS")
                    ?? Endpoints.HealthCheckSource)
            .AddResponseCaching();

        services.AddHeaderPropagation(o =>
        {
            o.Headers.Add(HttpHeaderKeys.HostService, HostServiceOptions.Gateway);
            o.Headers.Add(HttpHeaderKeys.CorrelationId);
        });

        services.AddCors(o =>
        {
            o.AddPolicy("CorsPolicy", p =>
                p.AllowAnyOrigin()
                 .AllowAnyMethod()
                 .AllowAnyHeader());
        });

        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders =
                ForwardedHeaders.XForwardedFor |
                ForwardedHeaders.XForwardedProto;

            o.KnownIPNetworks.Clear();
            o.KnownProxies.Clear();
        });

        builder.WebHost.AddAndConfigureSentry();

        return builder;
    }
}
