using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using Ocelot.Provider.Polly;

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
                             .AddPolly()
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
            var targetRatesHost = new Uri("http://homebudget-rates-api");

            var response = await _client.GetAsync(upstreamUrl);
            var redirectUrl = response.Headers.Location?.ToString();

            Assert.Multiple(() =>
            {
                Assert.That(HttpStatusCode.Redirect, Is.EqualTo(response.StatusCode));
                redirectUrl.Should().BeEquivalentTo($"{targetRatesHost}currency-rates");
            });
        }

        [Test]
        public async Task Should_ForwardTimelineQueryParametersUnchangedAsync()
        {
            const string accountId = "0f416c50-4479-4bf8-9f6a-7a51571eaa54";
            var upstreamUrl = new Uri(
                $"https://localhost:7298/gateway/accounting/payments-history/query/{accountId}" +
                "?page=2&pageSize=25&sortBy=amount&sortDirection=asc&dateFrom=2026-01-01&dateTo=2026-03-31" +
                "&type=expense&categoryId=7f06b6e3-b0cf-4ddf-bb41-a6362745d9d8&contractorId=6d86c5aa-271d-4f3b-bce3-620dfb1fab0c" +
                "&amountMin=10&amountMax=500");

            var response = await _client.GetAsync(upstreamUrl);

            response.StatusCode.Should().Be(HttpStatusCode.Redirect);
            response.Headers.Location.Should().NotBeNull();
            response.Headers.Location!.ToString().Should().Be(
                $"http://homebudget-accounting-api/payments-history/query/{accountId}" +
                "?page=2&pageSize=25&sortBy=amount&sortDirection=asc&dateFrom=2026-01-01&dateTo=2026-03-31" +
                "&type=expense&categoryId=7f06b6e3-b0cf-4ddf-bb41-a6362745d9d8&contractorId=6d86c5aa-271d-4f3b-bce3-620dfb1fab0c" +
                "&amountMin=10&amountMax=500");
        }
    }
}
