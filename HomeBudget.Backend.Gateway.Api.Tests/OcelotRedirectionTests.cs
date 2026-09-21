using System;
using System.Net;
using System.Net.Http;
using System.Linq;
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

        [TestCase("POST", "/gateway/accounting/payment-accounts", "/payment-accounts")]
        [TestCase("GET", "/gateway/accounting/payment-accounts/byId/abc", "/payment-accounts/byId/abc")]
        [TestCase("POST", "/gateway/accounting/categories", "/categories")]
        [TestCase("GET", "/gateway/accounting/categories/byId/abc", "/categories/byId/abc")]
        [TestCase("POST", "/gateway/accounting/contractors", "/contractors")]
        [TestCase("GET", "/gateway/accounting/contractors/byId/abc", "/contractors/byId/abc")]
        [TestCase("POST", "/gateway/accounting/payment-operations/account", "/payment-operations/account")]
        [TestCase("GET", "/gateway/accounting/payment-operations/account/commands/command", "/payment-operations/account/commands/command")]
        [TestCase("GET", "/gateway/accounting/payments-history/account/byId/operation", "/payments-history/account/byId/operation")]
        [TestCase("POST", "/gateway/accounting/cross-accounts-transfer", "/cross-accounts-transfer")]
        [TestCase("GET", "/gateway/accounting/cross-accounts-transfer/transfer/commands/command", "/cross-accounts-transfer/transfer/commands/command")]
        [TestCase("GET", "/gateway/accounting/cross-accounts-transfer/byId/transfer", "/cross-accounts-transfer/byId/transfer")]
        public async Task ExplicitAccountingRoutesTargetAccountingOnlyAsync(
            string method,
            string upstreamPath,
            string downstreamPath)
        {
            using var request = new HttpRequestMessage(new HttpMethod(method), new Uri($"https://localhost:7298{upstreamPath}"));
            using var response = await _client.SendAsync(request);

            Assert.Multiple(() =>
            {
                Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Redirect));
                Assert.That(response.Headers.Location, Is.EqualTo(new Uri($"http://homebudget-accounting-api{downstreamPath}")));
                Assert.That(response.Headers.Location!.Host, Is.Not.EqualTo("homebudget-rates-api"));
            });
        }

        [Test]
        public async Task PaymentIdempotencyKeyIsForwardedUnchangedAsync()
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                new Uri("https://localhost:7298/gateway/accounting/payment-operations/account"));
            request.Headers.TryAddWithoutValidation("Idempotency-Key", "migration-key-123");

            using var response = await _client.SendAsync(request);

            Assert.That(response.Headers.GetValues("X-Observed-Idempotency-Key").Single(), Is.EqualTo("migration-key-123"));
        }

        [Test]
        public async Task UnsupportedAccountingMethodIsRejectedAsync()
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Delete,
                new Uri("https://localhost:7298/gateway/accounting/categories"));

            using var response = await _client.SendAsync(request);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        }
    }
}
