using System;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

using HomeBudget.Backend.Gateway.Extensions;
using HomeBudget.Backend.Gateway.Extensions.OpenTelemetry;
using HomeBudget.Core.Options;

var webAppBuilder = WebApplication.CreateBuilder(args);
var services = webAppBuilder.Services;
var configuration = webAppBuilder.Configuration;
var environment = webAppBuilder.Environment;

webAppBuilder
    .AddGatewayConfiguration()
    .AddGatewayLogging()
    .AddGatewayKestrel()
    .AddGatewayServices()
    .AddGatewayObservability();

var serviceVersion = typeof(Program).Assembly.GetName().Version?.ToString();
var isTracingEnabled = services.TryAddTracingSupport(
   configuration,
   environment,
   HostServiceOptions.Gateway,
   serviceVersion);

services.AddAllElasticApm();

var app = webAppBuilder.Build();

try
{
    await app.UseGatewayPipelineAsync();

    if (isTracingEnabled)
    {
        app.SetupOpenTelemetry();
        app.MapPrometheusScrapingEndpoint("/metrics");
    }

    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Gateway terminated unexpectedly");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}
