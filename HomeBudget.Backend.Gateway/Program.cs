using System;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

using HomeBudget.Backend.Gateway;
using HomeBudget.Backend.Gateway.Models;

var builder = Host.CreateDefaultBuilder(args)
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

        if (string.Equals(environment, "Development"))
        {
            config.AddJsonFile("appsettings.Local.json", true, true);
        }
    })
    .ConfigureWebHostDefaults((webBuilder) =>
    {
        webBuilder.UseStartup<Startup>().ConfigureKestrel((context, serverOptions) =>
        {
            var configuration = context.Configuration;
            var sslOptions = configuration.GetSection(nameof(SslOptions)).Get<SslOptions>();

            serverOptions.ConfigureHttpsDefaults(httpsOptions =>
            {
                if (IsCertificateOptionsPopulated(sslOptions))
                {
                    httpsOptions.ServerCertificate = new X509Certificate2(sslOptions.CertificateName, sslOptions.Password);
                }
            });

            serverOptions.ListenAnyIP(sslOptions.Port, listenOptions =>
            {
                if (IsCertificateOptionsPopulated(sslOptions))
                {
                    listenOptions.UseHttps(sslOptions.CertificateName, sslOptions.Password);
                }
            });
        });
    });

await builder.Build().RunAsync();

static bool IsCertificateOptionsPopulated(SslOptions sslOptions)
{
    if (string.IsNullOrWhiteSpace(sslOptions.CertificateName) || string.IsNullOrWhiteSpace(sslOptions.Password))
    {
        throw new InvalidOperationException("HTTPS configuration is missing in appsettings.json");
    }

    return true;
}