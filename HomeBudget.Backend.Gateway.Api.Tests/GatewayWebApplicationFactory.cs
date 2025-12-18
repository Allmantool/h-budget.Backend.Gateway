using System.Collections.Generic;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;

namespace HomeBudget.Backend.Gateway.Api.Tests
{
    public sealed class GatewayWebApplicationFactory
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");

            builder.ConfigureAppConfiguration((_, config) =>
            {
                var inMemory = new Dictionary<string, string?>
                {
                    ["SslOptions:HttpPort"] = "5000",
                    ["SslOptions:HttpsPort"] = "5001",
                    ["SslOptions:CertificateName"] = "dummy.pfx",
                    ["SslOptions:Password"] = "dummy"
                };

                config.AddInMemoryCollection(inMemory);
            });

            builder.UseTestServer();
        }
    }
}
