using System;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

using HomeBudget.Backend.Gateway.Models;

namespace HomeBudget.Backend.Gateway.Infrastructure;

internal sealed class SslKestrelConfigurator : IKestrelConfigurator
{
    public void Configure(
        WebHostBuilderContext context,
        KestrelServerOptions options)
    {
        var ssl = context.Configuration
            .GetSection(nameof(SslOptions))
            .Get<SslOptions>();

        if (ssl is null)
        {
            return;
        }

        options.ListenAnyIP(ssl.HttpPort, l =>
            l.Protocols = HttpProtocols.Http1);

        if (context.HostingEnvironment.IsDevelopment())
        {
            return;
        }

        Validate(ssl);

        var cert = X509CertificateLoader.LoadPkcs12FromFile(
            ssl.GetFullPath(),
            ssl.Password);

        options.ListenAnyIP(ssl.HttpsPort, l =>
        {
            l.Protocols = HttpProtocols.Http1AndHttp2;
            l.UseHttps(cert);
        });
    }

    private static void Validate(SslOptions ssl)
    {
        if (string.IsNullOrWhiteSpace(ssl.CertificateName) ||
            string.IsNullOrWhiteSpace(ssl.Password))
        {
            throw new InvalidOperationException(
                "HTTPS configuration is missing or invalid.");
        }
    }
}
