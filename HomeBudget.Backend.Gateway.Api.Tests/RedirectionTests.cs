using System.Net;

using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

namespace HomeBudget.Backend.Gateway.Api.Tests
{
    [TestFixture]
    public class OcelotRedirectionTests
    {
        private TestServer _server;
        private HttpClient _client;

        [OneTimeSetUp]
        public void SetUp()
        {
            var builder = new WebHostBuilder()
                 .ConfigureAppConfiguration((_, config) =>
                 {
                     config.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);
                 })
                 .ConfigureServices(services =>
                 {
                     services.AddSingleton<MockDownstreamHandler>();
                     services.AddOcelot()
                             .AddDelegatingHandler<MockDownstreamHandler>(true);
                 })
                 .Configure(app =>
                 {
                     app.UseOcelot().Wait();
                 });

            _server = new TestServer(builder);
            _client = _server.CreateClient();
        }

        [OneTimeTearDown]
        public void TearDown()
        {
            _client.Dispose();
            _server.Dispose();
        }

        [Test]
        public async Task Should_RedirectsRatesRequestCorrectlyAsync()
        {
            var upstreamUrl = new Uri("https://localhost:7298/gateway/currency-rates");
            var targetRatesHost = new Uri("http://host-server:5207");

            var response = await _client.GetAsync(upstreamUrl);
            var redirectUrl = response.Headers.Location?.ToString();

            Assert.Multiple(() =>
            {
                Assert.That(HttpStatusCode.Redirect, Is.EqualTo(response.StatusCode));
                redirectUrl.Should().BeEquivalentTo($"{targetRatesHost}currency-rates");
            });
        }
    }
}
