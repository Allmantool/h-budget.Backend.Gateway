using System;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog;

using HomeBudget.Backend.Gateway;
using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Extensions.Logs;
using HomeBudget.Backend.Gateway.Models;

var hostBuilder = Host.CreateDefaultBuilder(args);

var hostEnvironmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

hostBuilder
    .UseSerilog((hostingContext, loggerConfiguration) =>
    {
        var config = hostingContext.Configuration;

        loggerConfiguration.ConfigureSerilog(config, hostingContext.HostingEnvironment);
    })
    .ConfigureAppConfiguration((hostingContext, config) =>
    {
        var environment = hostingContext.HostingEnvironment.EnvironmentName;

        config
            .SetBasePath(hostingContext.HostingEnvironment.ContentRootPath)
            .AddJsonFile("appsettings.json", true, true)
            .AddJsonFile("ocelot.json", false, true)
            .AddJsonFile($"appsettings.{environment}.json", true, true)
            .AddJsonFile($"ocelot.{environment}.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables();

        if (HostEnvironments.Development.Equals(environment, StringComparison.Ordinal))
        {
            config.AddJsonFile("appsettings.Local.json", true, true);
        }
    })
    .ConfigureLogging((hostingContext, loggingBuilder) =>
    {
        var configuration = hostingContext.Configuration;
        var env = hostingContext.HostingEnvironment;

        configuration.InitializeLogger(env, loggingBuilder);

        loggingBuilder.AddOpenTelemetryMetrics();
    })
    .ConfigureWebHostDefaults((webBuilder) =>
    {
        webBuilder.UseStartup<Startup>().ConfigureKestrel((context, serverOptions) =>
        {
            var configuration = context.Configuration;
            var hostEnvironment = context.HostingEnvironment;
            var sslOptions = configuration.GetSection(nameof(SslOptions))?.Get<SslOptions>();

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

            serverOptions.ConfigureHttpsDefaults(httpsOptions =>
            {
                if (IsCertificateOptionsPopulated(sslOptions))
                {
                    httpsOptions.ServerCertificate = X509CertificateLoader.LoadPkcs12FromFile(sslOptions.CertificateName, sslOptions.Password);
                }
            });

            serverOptions.ListenAnyIP(sslOptions.HttpsPort, listenOptions =>
            {
                if (IsCertificateOptionsPopulated(sslOptions))
                {
                    listenOptions.UseHttps(sslOptions.CertificateName, sslOptions.Password);
                }
            });
        });
    });

var appHost = hostBuilder.Build();

try
{
    await appHost.RunAsync();
}
catch (Exception ex)
{
    Log.Logger.Error($"Fatal error: {ex}");
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