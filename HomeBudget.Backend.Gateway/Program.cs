using System;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using Ocelot.DependencyInjection;
using Ocelot.Middleware;

using Serilog;

using HomeBudget.Backend.Gateway.Configuration;
using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Extensions;
using HomeBudget.Backend.Gateway.Extensions.Logs;
using HomeBudget.Backend.Gateway.Extensions.OpenTelemetry;
using HomeBudget.Backend.Gateway.Middlewares;
using HomeBudget.Backend.Gateway.Models;
using HomeBudget.Core.Options;

var builder = WebApplication.CreateBuilder(args);

var services = builder.Services;
var environment = builder.Environment;
var configuration = builder.Configuration;

configuration
    .SetBasePath(environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile("ocelot.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"ocelot.{environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

if (environment.IsDevelopment())
{
    configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
}

builder.Host.UseSerilog((context, loggerConfig) =>
{
    loggerConfig.ConfigureSerilog(
        context.Configuration,
        environment);
});

builder.Configuration.InitializeLogger(
    environment,
    builder.Logging,
    builder.Host,
    HostServiceOptions.Gateway);

builder.WebHost.ConfigureKestrel((context, options) =>
{
    var sslOptions = context.Configuration
        .GetSection(nameof(SslOptions))
        .Get<SslOptions>();

    if (sslOptions is null)
    {
        return;
    }

    // HTTP (always enabled)
    options.ListenAnyIP(sslOptions.HttpPort, listen =>
    {
        listen.Protocols = HttpProtocols.Http1;
    });

    if (context.HostingEnvironment.IsDevelopment())
    {
        return;
    }

    if (IsCertificateOptionsPopulated(sslOptions))
    {
        var certificate = X509CertificateLoader.LoadPkcs12FromFile(
            sslOptions.GetFullPath(),
            sslOptions.Password);

        options.ListenAnyIP(sslOptions.HttpsPort, listen =>
        {
            listen.Protocols = HttpProtocols.Http1AndHttp2;
            listen.UseHttps(certificate);
        });
    }
});

services.AddControllers();

services.AddOcelot(configuration);

services.AddEndpointsApiExplorer()
    .SetUpHealthCheck(
        configuration,
        Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? Endpoints.HealthCheckSource)
    .AddResponseCaching();

services.AddHeaderPropagation(options =>
{
    options.Headers.Add(HttpHeaderKeys.HostService, HostServiceOptions.Gateway);
    options.Headers.Add(HttpHeaderKeys.CorrelationId);
});

services.AddCors(options =>
{
    options.AddPolicy(
        "CorsPolicy",
        policy => policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());
});

services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;

    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.WebHost.AddAndConfigureSentry();

builder.Logging.AddOpenTelemetryMetrics();

var serviceVersion =
    typeof(Program).Assembly.GetName().Version?.ToString();

var isTracingEnabled = services.TryAddTracingSupport(
    configuration,
    environment,
    HostServiceOptions.Gateway,
    serviceVersion);

var app = builder.Build();

if (environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHsts();
}

app.SetUpBaseApplication(environment, configuration);
app.SetupOpenTelemetry();

app.UseForwardedHeaders();
app.UseMiddleware<HttpsEnforcementMiddleware>();

app.UseCors("CorsPolicy");
app.UseMiddleware<OcelotLoggingMiddleware>();

await app.UseOcelot();

if (isTracingEnabled)
{
    app.UseOpenTelemetryPrometheusScrapingEndpoint();
    app.MapPrometheusScrapingEndpoint("/metrics");
}

try
{
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

static bool IsCertificateOptionsPopulated(SslOptions sslOptions)
{
    if (string.IsNullOrWhiteSpace(sslOptions.CertificateName) ||
        string.IsNullOrWhiteSpace(sslOptions.Password))
    {
        throw new InvalidOperationException(
            "HTTPS configuration is missing or invalid in appsettings.json");
    }

    return true;
}
