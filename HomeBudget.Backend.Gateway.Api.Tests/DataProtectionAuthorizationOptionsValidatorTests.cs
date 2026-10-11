using System.Collections.Generic;

using System.Threading.Tasks;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

using HomeBudget.Backend.Gateway.Authorization;
using HomeBudget.Backend.Gateway.Extensions;

namespace HomeBudget.Backend.Gateway.Api.Tests;

[TestFixture]
internal sealed class DataProtectionAuthorizationOptionsValidatorTests
{
    private readonly DataProtectionAuthorizationOptionsValidator _validator =
        new(new TestHostEnvironment(Environments.Production));

    [Test]
    public void DisabledRoutesDoNotRequireAuthorityConfiguration()
    {
        var result = _validator.Validate(null, new DataProtectionAuthorizationOptions());

        Assert.That(result.Succeeded, Is.True);
    }

    [Test]
    public void EnabledRoutesRejectMissingAuthorityAndAudience()
    {
        var result = _validator.Validate(
            null,
            new DataProtectionAuthorizationOptions { Enabled = true });

        Assert.Multiple(() =>
        {
            Assert.That(result.Failed, Is.True);
            Assert.That(result.Failures, Has.Some.Contains("Authority"));
            Assert.That(result.Failures, Has.Some.Contains("Audience"));
        });
    }

    [Test]
    public void ProductionRejectsInsecureAuthorityAndMetadata()
    {
        var result = _validator.Validate(
            null,
            CreateEnabledOptions("http://issuer.example", requireHttpsMetadata: false));

        Assert.Multiple(() =>
        {
            Assert.That(result.Failed, Is.True);
            Assert.That(result.Failures, Has.Some.Contains("must use HTTPS"));
            Assert.That(result.Failures, Has.Some.Contains("RequireHttpsMetadata"));
        });
    }

    [Test]
    public void ProductionAcceptsCompleteHttpsConfiguration()
    {
        var result = _validator.Validate(
            null,
            CreateEnabledOptions("https://issuer.example", requireHttpsMetadata: true));

        Assert.That(result.Succeeded, Is.True);
    }

    [Test]
    public async Task EnabledProductionHostFailsStartupWhenAuthorityIsMissing()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Production
        });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string>
        {
            ["DataProtectionAuthorization:Enabled"] = "true",
            ["DataProtectionAuthorization:Authority"] = string.Empty,
            ["DataProtectionAuthorization:Audience"] = "home-ledger"
        });
        builder.AddDataProtectionAuthorization();
        await using var app = builder.Build();

        Assert.ThrowsAsync<OptionsValidationException>(() => app.StartAsync());
    }

    private static DataProtectionAuthorizationOptions CreateEnabledOptions(
        string authority,
        bool requireHttpsMetadata) => new()
        {
            Enabled = true,
            Authority = authority,
            Audience = "home-ledger",
            RequireHttpsMetadata = requireHttpsMetadata
        };
}
