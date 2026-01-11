using System;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Extensions;
using HomeBudget.Backend.Gateway.Extensions.Logs;
using HomeBudget.Backend.Gateway.Extensions.OpenTelemetry;
using HomeBudget.Backend.Gateway.Models;
using HomeBudget.Core.Options;

var webAppBuilder = WebApplication.CreateBuilder(args);
var webHost = webAppBuilder.WebHost;
var services = webAppBuilder.Services;
var environment = webAppBuilder.Environment;
var applicationName = environment.ApplicationName;
var configuration = webAppBuilder.Configuration;

var hostEnvironmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

configuration
    .SetBasePath(webAppBuilder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile("ocelot.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"ocelot.{environment}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

if (HostEnvironments.Development.Equals(environment.EnvironmentName, StringComparison.Ordinal))
{
    configuration.AddJsonFile("appsettings.Local.json", true, true);
}

webAppBuilder.Host.UseSerilog((hostingContext, loggerConfiguration) =>
{
    loggerConfiguration.ConfigureSerilog(
        hostingContext.Configuration,
        environment);
});

webAppBuilder.Configuration.InitializeLogger(
    webAppBuilder.Environment,
    webAppBuilder.Logging,
    webAppBuilder.Host,
    HostServiceOptions.Gateway);

webAppBuilder.Logging.AddOpenTelemetryMetrics();

webHost.ConfigureKestrel((context, serverOptions) =>
{
    var configuration = context.Configuration;
    var hostEnvironment = context.HostingEnvironment;
    var sslOptions = configuration.GetSection(nameof(SslOptions)).Get<SslOptions>();

    if (sslOptions is null)
    {
        return;
    }

    serverOptions.ListenAnyIP(sslOptions.HttpPort, listen =>
    {
        listen.Protocols = HttpProtocols.Http1;
    });

    if (hostEnvironment.IsDevelopment())
    {
        return;
    }

    if (IsCertificateOptionsPopulated(sslOptions))
    {
        var cert = X509CertificateLoader.LoadPkcs12FromFile(
            sslOptions.GetFullPath(),
            sslOptions.Password);

        serverOptions.ListenAnyIP(sslOptions.HttpsPort, listen =>
        {
            listen.UseHttps(cert);
        });
    }
});

webHost.AddAndConfigureSentry();

var serviceVersion = typeof(Program).Assembly.GetName().Version?.ToString();
var isTracingEnabled = services.TryAddTracingSupport(
   configuration,
   environment,
   HostServiceOptions.Gateway,
   serviceVersion);

var app = webAppBuilder.Build();

try
{
    if (isTracingEnabled)
    {
        app.UseOpenTelemetryPrometheusScrapingEndpoint();
        app.MapPrometheusScrapingEndpoint("/metrics");
    }

    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Logger.Error(ex, "Fatal error");
    Environment.Exit(1);
}

static bool IsCertificateOptionsPopulated(SslOptions sslOptions)
{
    if (string.IsNullOrWhiteSpace(sslOptions.CertificateName) || string.IsNullOrWhiteSpace(sslOptions.Password))
    {
        throw new InvalidOperationException("HTTPS configuration is missing in appsettings.json");
    }

    return true;
}