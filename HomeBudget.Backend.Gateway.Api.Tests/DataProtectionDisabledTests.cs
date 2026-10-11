using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace HomeBudget.Backend.Gateway.Api.Tests;

[TestFixture]
internal sealed class DataProtectionDisabledTests
{
    [Test]
    public async Task DefaultConfigurationDoesNotForwardDataProtectionRoute()
    {
        await using var factory = new GatewayWebApplicationFactory();
        using var probe = new DownstreamInvocationProbe();
        using var client = factory.CreateClient(new()
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            new Uri("/gateway/accounting/data-protection/v1/capabilities", UriKind.Relative));

        using var response = await client.SendAsync(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(probe.Count, Is.Zero);
        });
    }
}
