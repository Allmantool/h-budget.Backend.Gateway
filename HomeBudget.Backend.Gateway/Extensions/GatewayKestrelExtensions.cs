using System;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

using HomeBudget.Backend.Gateway.Infrastructure;
using HomeBudget.Backend.Gateway.Models;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayKestrelExtensions
{
    public static WebApplicationBuilder AddGatewayKestrel(
        this WebApplicationBuilder builder)
    {
        var webHost = builder.WebHost;

        var configurator = new SslKestrelConfigurator();

        webHost.ConfigureKestrel(configurator.Configure);

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

        return builder;
    }

    private static bool IsCertificateOptionsPopulated(SslOptions sslOptions)
    {
        if (string.IsNullOrWhiteSpace(sslOptions.CertificateName) || string.IsNullOrWhiteSpace(sslOptions.Password))
        {
            throw new InvalidOperationException("HTTPS configuration is missing in appsettings.json");
        }

        return true;
    }
}
