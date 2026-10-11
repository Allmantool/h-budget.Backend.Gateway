using System.Collections.Generic;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HomeBudget.Backend.Gateway.Api.Tests;

internal sealed class DataProtectionGatewayWebApplicationFactory
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string>
            {
                ["SslOptions:HttpPort"] = "5000",
                ["SslOptions:HttpsPort"] = "5001",
                ["SslOptions:CertificateName"] = "dummy.pfx",
                ["SslOptions:Password"] = "test-only",
                ["MigrationContract:EnvironmentIdentity"] = "gateway-security-test",
                ["MigrationContract:InstanceIdentity"] = "gateway-test-instance",
                ["MigrationContract:Commit"] = "test-commit",
                ["DataProtectionAuthorization:Enabled"] = "true",
                ["DataProtectionAuthorization:Authority"] = "https://test-issuer.invalid",
                ["DataProtectionAuthorization:Audience"] = "home-ledger-test",
                ["DataProtectionAuthorization:AdministratorRole"] = "data-protection-administrator",
                ["DataProtectionAuthorization:RequiredScope"] = "home-ledger.data-protection.admin",
                ["DataProtectionAuthorization:RecentAuthenticationSeconds"] = "900",
                ["DataProtectionAuthorization:FutureClockSkewSeconds"] = "60",
                ["DataProtectionAuthorization:RequireHttpsMetadata"] = "true",
                ["Routes:0:AuthenticationOptions:AuthenticationProviderKeys:0"] =
                    DataProtectionTestAuthenticationHandler.SchemeName
            });
        });

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = DataProtectionTestAuthenticationHandler.SchemeName;
                options.DefaultChallengeScheme = DataProtectionTestAuthenticationHandler.SchemeName;
                options.DefaultForbidScheme = DataProtectionTestAuthenticationHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, DataProtectionTestAuthenticationHandler>(
                DataProtectionTestAuthenticationHandler.SchemeName,
                _ => { });
        });

        builder.UseTestServer();
    }
}
