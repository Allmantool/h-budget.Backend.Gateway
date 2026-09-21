using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

using HomeBudget.Backend.Gateway.Models.Migration;

namespace HomeBudget.Backend.Gateway.Api.Tests;

[TestFixture]
internal sealed class GatewayMetadataTests
{
    [Test]
    public async Task IdentityUsesTrustedConfigurationAndExposesNoSecrets()
    {
        await using var factory = new GatewayWebApplicationFactory();
        using var client = CreateClient(factory);

        using var response = await client.GetAsync(new Uri("/gateway/meta/identity?environmentIdentity=caller-value", UriKind.Relative));
        var body = await response.Content.ReadAsStringAsync();
        var identity = await response.Content.ReadFromJsonAsync<GatewayIdentityResponse>();

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(identity, Is.Not.Null);
            Assert.That(identity!.Service, Is.EqualTo("HomeBudget.Backend.Gateway"));
            Assert.That(identity.Environment, Is.EqualTo("Production"));
            Assert.That(identity.EnvironmentIdentity, Is.EqualTo("vm2-test"));
            Assert.That(identity.InstanceIdentity, Is.EqualTo("gateway-test-instance"));
            Assert.That(identity.MigrationContractVersion, Is.EqualTo(1));
            Assert.That(body, Does.Not.Contain("caller-value"));
            Assert.That(body, Does.Not.Contain("dummy-secret"));
        });
    }

    [Test]
    public async Task CapabilitiesDescribeCurrentSafeAndUnsafeGuarantees()
    {
        await using var factory = new GatewayWebApplicationFactory();
        using var client = CreateClient(factory);

        var capabilities = await client.GetFromJsonAsync<MigrationCapabilitiesResponse>(
            "/gateway/accounting/meta/migration-capabilities");

        Assert.Multiple(() =>
        {
            Assert.That(capabilities, Is.Not.Null);
            Assert.That(capabilities!.MigrationContractVersion, Is.EqualTo(1));
            Assert.That(capabilities.Accounts.RouteAvailable, Is.True);
            Assert.That(capabilities.Accounts.IdempotentCreate, Is.True);
            Assert.That(capabilities.Accounts.MigrationSafe, Is.True);
            Assert.That(capabilities.Categories.IdempotentCreate, Is.True);
            Assert.That(capabilities.Categories.MigrationSafe, Is.True);
            Assert.That(capabilities.Contractors.IdempotentCreate, Is.True);
            Assert.That(capabilities.Contractors.MigrationSafe, Is.True);
            Assert.That(capabilities.Payments.IdempotencySupported, Is.True);
            Assert.That(capabilities.Payments.CommandStatusAvailable, Is.True);
            Assert.That(capabilities.Payments.ReadbackAvailable, Is.True);
            Assert.That(capabilities.Payments.MigrationSafe, Is.True);
            Assert.That(capabilities.Transfers.RouteAvailable, Is.True);
            Assert.That(capabilities.Transfers.Idempotent, Is.True);
            Assert.That(capabilities.Transfers.AtomicAcceptance, Is.True);
            Assert.That(capabilities.Transfers.CommandStatusAvailable, Is.True);
            Assert.That(capabilities.Transfers.TwoSideReadbackAvailable, Is.True);
            Assert.That(capabilities.Transfers.MigrationSafe, Is.True);
            Assert.That(capabilities.MigrationAdjustments.Mechanism, Is.EqualTo("ordinaryPayment"));
            Assert.That(capabilities.MigrationAdjustments.ReferencePrerequisitesSafe, Is.True);
            Assert.That(capabilities.MigrationAdjustments.MigrationSafe, Is.True);
        });
    }

    [TestCase("/gateway/meta/identity")]
    [TestCase("/gateway/accounting/meta/migration-capabilities")]
    public async Task MetadataContractsRejectPost(string path)
    {
        await using var factory = new GatewayWebApplicationFactory();
        using var client = CreateClient(factory);

        using var content = JsonContent.Create(new { });
        using var response = await client.PostAsync(new Uri(path, UriKind.Relative), content);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.MethodNotAllowed));
    }

    private static HttpClient CreateClient(GatewayWebApplicationFactory factory) => factory.CreateClient(
        new()
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
}
