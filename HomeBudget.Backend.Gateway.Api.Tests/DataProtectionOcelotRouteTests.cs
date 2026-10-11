using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using Ocelot.Provider.Polly;

using HomeBudget.Backend.Gateway.Authorization;

namespace HomeBudget.Backend.Gateway.Api.Tests;

[TestFixture]
internal sealed class DataProtectionOcelotRouteTests : IDisposable
{
    private TestServer _server = null!;
    private HttpClient _client = null!;

    [OneTimeSetUp]
    public void SetUp()
    {
        var builder = new WebHostBuilder()
            .ConfigureAppConfiguration((_, configuration) =>
                configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true))
            .ConfigureServices(services =>
            {
                services.AddAuthentication()
                    .AddScheme<AuthenticationSchemeOptions, DataProtectionTestAuthenticationHandler>(
                        DataProtectionAuthorizationDefaults.BearerScheme,
                        _ => { });
                services.AddSingleton<MockDownstreamHandler>();
                services.AddOcelot()
                    .AddPolly()
                    .AddDelegatingHandler<MockDownstreamHandler>(global: true);
            })
            .Configure(app => app.UseOcelot().Wait());

        _server = new TestServer(builder);
        _client = _server.CreateClient();
    }

    [OneTimeTearDown]
    public void TearDown() => Dispose();

    public void Dispose()
    {
        _client.Dispose();
        _server.Dispose();
    }

    [TestCase("POST", "/gateway/accounting/data-protection/v1/plans", "/data-protection/v1/plans")]
    [TestCase("GET", "/gateway/accounting/data-protection/v1/operations/operation", "/data-protection/v1/operations/operation")]
    public async Task RoutesDataProtectionRequestsToAccountingAsync(
        string method,
        string upstreamPath,
        string downstreamPath)
    {
        using var request = CreateAuthorizedRequest(new HttpMethod(method), upstreamPath);
        using var response = await _client.SendAsync(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Redirect));
            Assert.That(
                response.Headers.Location,
                Is.EqualTo(new Uri($"http://homebudget-accounting-api{downstreamPath}")));
            Assert.That(response.Headers.Location!.Host, Is.Not.EqualTo("homebudget-rates-api"));
        });
    }

    [Test]
    public async Task RejectsUnsupportedMethodWithoutForwardingAsync()
    {
        var handler = _server.Services.GetRequiredService<MockDownstreamHandler>();
        handler.Reset();
        using var request = CreateAuthorizedRequest(
            HttpMethod.Delete,
            "/gateway/accounting/data-protection/v1/operations/operation");

        using var response = await _client.SendAsync(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(handler.RequestCount, Is.Zero);
        });
    }

    [Test]
    public async Task ForwardsAdministrativeHeadersUnchangedAsync()
    {
        using var request = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/gateway/accounting/data-protection/v1/operations");
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer test-token");
        request.Headers.TryAddWithoutValidation("Idempotency-Key", "operation-key-1");
        request.Headers.TryAddWithoutValidation("If-Match", "\"generation-token-1\"");
        request.Headers.TryAddWithoutValidation("CorrelationId", "correlation-1");
        request.Headers.TryAddWithoutValidation(
            "traceparent",
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        request.Headers.TryAddWithoutValidation("tracestate", "vendor=value");
        request.Headers.TryAddWithoutValidation("baggage", "ledger=default");

        using var response = await _client.SendAsync(request);

        Assert.Multiple(() =>
        {
            AssertObservedHeader(response, "Authorization", "Bearer test-token");
            AssertObservedHeader(response, "Idempotency-Key", "operation-key-1");
            AssertObservedHeader(response, "If-Match", "\"generation-token-1\"");
            AssertObservedHeader(response, "CorrelationId", "correlation-1");
            AssertObservedHeader(
                response,
                "traceparent",
                "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
            AssertObservedHeader(response, "tracestate", "vendor=value");
            AssertObservedHeader(response, "baggage", "ledger=default");
        });
    }

    [Test]
    public async Task PropagatesDownstreamErrorAsync()
    {
        using var request = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/gateway/accounting/data-protection/v1/operations/operation");
        request.Headers.TryAddWithoutValidation("X-Test-Downstream-Status", "503");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.ServiceUnavailable));
    }

    [Test]
    public async Task DisconnectCancelsDownstreamRequest()
    {
        var handler = _server.Services.GetRequiredService<MockDownstreamHandler>();
        handler.Reset();
        using var request = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/gateway/accounting/data-protection/v1/operations/operation");
        request.Headers.TryAddWithoutValidation("X-Test-Wait-For-Cancellation", "true");
        using var cancellation = new CancellationTokenSource();

        cancellation.CancelAfter(TimeSpan.FromMilliseconds(100));

        try
        {
            await _client.SendAsync(request, cancellation.Token);
            Assert.Fail("The downstream request completed after the client disconnected.");
        }
        catch (OperationCanceledException)
        {
            // Expected: the client cancellation reaches the downstream handler.
        }

        var cancellationObserved = SpinWait.SpinUntil(
            () => handler.CancellationObserved,
            TimeSpan.FromSeconds(1));
        Assert.Multiple(() =>
        {
            Assert.That(handler.RequestStarted, Is.True);
            Assert.That(cancellationObserved, Is.True);
        });
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(
            method,
            new Uri($"https://localhost:7298{path}"));
        request.Headers.TryAddWithoutValidation("X-Test-Subject", "administrator-1");
        request.Headers.TryAddWithoutValidation("X-Test-Scope", "home-ledger.data-protection.admin");
        return request;
    }

    private static void AssertObservedHeader(
        HttpResponseMessage response,
        string headerName,
        string expectedValue)
    {
        Assert.That(
            response.Headers.GetValues($"X-Observed-{headerName}").Single(),
            Is.EqualTo(expectedValue));
    }
}
