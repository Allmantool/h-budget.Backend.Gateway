using System;
using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace HomeBudget.Backend.Gateway.Api.Tests;

[TestFixture]
internal sealed class DataProtectionAuthorizationTests : IDisposable
{
    private const string AdministratorPolicy = "DataProtectionAdministrator";
    private const string RecentAdministratorPolicy = "DataProtectionRecentlyAuthenticatedAdministrator";
    private const string CapabilitiesPath = "/gateway/accounting/data-protection/v1/capabilities";
    private const string OperationStatusPath =
        "/gateway/accounting/data-protection/v1/operations/87cb2cd6-85c8-48f4-91ef-c96fb3cbff88";
    private const string PlanPath = "/gateway/accounting/data-protection/v1/plans";

    private DataProtectionGatewayWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;
    private DownstreamInvocationProbe _invocationProbe = null!;

    [OneTimeSetUp]
    public void SetUp()
    {
        _factory = new DataProtectionGatewayWebApplicationFactory();
        _client = _factory.CreateClient(new()
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
        _invocationProbe = new DownstreamInvocationProbe();
    }

    [OneTimeTearDown]
    public void TearDown() => Dispose();

    public void Dispose()
    {
        _client.Dispose();
        _invocationProbe.Dispose();
        _factory.Dispose();
    }

    [Test]
    public async Task RegistersNamedAdministratorPolicy()
    {
        var provider = _factory.Services.GetRequiredService<IAuthorizationPolicyProvider>();

        var policy = await provider.GetPolicyAsync(AdministratorPolicy);

        Assert.That(policy, Is.Not.Null);
    }

    [Test]
    public async Task RegistersNamedRecentAdministratorPolicy()
    {
        var provider = _factory.Services.GetRequiredService<IAuthorizationPolicyProvider>();

        var policy = await provider.GetPolicyAsync(RecentAdministratorPolicy);

        Assert.That(policy, Is.Not.Null);
    }

    [Test]
    public async Task AnonymousPlanRequestIsRejectedBeforeDownstreamInvocation()
    {
        _invocationProbe.Reset();
        using var request = CreatePlanRequest();
        using var response = await _client.SendAsync(request);

        AssertRejectedBeforeDownstream(response, HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task CallerWithoutAdministratorRoleIsRejectedBeforeDownstreamInvocation()
    {
        _invocationProbe.Reset();
        using var request = CreatePlanRequest();
        request.Headers.Add("X-Test-Subject", "operator-1");
        request.Headers.Add("X-Test-Role", "ledger-user");
        request.Headers.Add("X-Test-Scope", "home-ledger.data-protection.admin");
        request.Headers.Add(
            "X-Test-Auth-Time",
            DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));

        using var response = await _client.SendAsync(request);

        AssertRejectedBeforeDownstream(response, HttpStatusCode.Forbidden);
    }

    [Test]
    public async Task AdministratorWithStaleAuthenticationIsRejectedBeforeDownstreamInvocation()
    {
        _invocationProbe.Reset();
        using var request = CreatePlanRequest();
        request.Headers.Add("X-Test-Subject", "administrator-1");
        request.Headers.Add("X-Test-Role", "data-protection-administrator");
        request.Headers.Add("X-Test-Scope", "home-ledger.data-protection.admin");
        request.Headers.Add(
            "X-Test-Auth-Time",
            DateTimeOffset.UtcNow.AddHours(-2).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));

        using var response = await _client.SendAsync(request);

        AssertRejectedBeforeDownstream(response, HttpStatusCode.Forbidden);
    }

    [TestCase(CapabilitiesPath, "homebudget-accounting-api/data-protection/v1/capabilities")]
    [TestCase(OperationStatusPath, "homebudget-accounting-api/data-protection/v1/operations/")]
    public async Task AdministratorWithStaleAuthenticationCanReadDataProtectionStatus(
        string requestPath,
        string downstreamPath)
    {
        _invocationProbe.Reset();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(requestPath, UriKind.Relative));
        AddAdministratorHeaders(request, DateTimeOffset.UtcNow.AddHours(-2));

        using var response = await _client.SendAsync(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadGateway));
            Assert.That(_invocationProbe.Count, Is.GreaterThan(0));
            Assert.That(_invocationProbe.RequestUris, Has.Some.Contains(downstreamPath));
        });
    }

    [TestCase(CapabilitiesPath)]
    [TestCase(OperationStatusPath)]
    public async Task CallerWithoutAdministratorRoleCannotReadDataProtectionStatus(string requestPath)
    {
        _invocationProbe.Reset();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(requestPath, UriKind.Relative));
        request.Headers.Add("X-Test-Subject", "operator-1");
        request.Headers.Add("X-Test-Role", "ledger-user");
        request.Headers.Add("X-Test-Scope", "home-ledger.data-protection.admin");

        using var response = await _client.SendAsync(request);

        AssertRejectedBeforeDownstream(response, HttpStatusCode.Forbidden);
    }

    [Test]
    public async Task AdministratorWithNonNumericAuthenticationTimeIsRejectedBeforeDownstreamInvocation()
    {
        _invocationProbe.Reset();
        using var request = CreatePlanRequest();
        request.Headers.Add("X-Test-Subject", "administrator-1");
        request.Headers.Add("X-Test-Role", "data-protection-administrator");
        request.Headers.Add("X-Test-Scope", "home-ledger.data-protection.admin");
        request.Headers.Add("X-Test-Auth-Time", "not-a-number");

        using var response = await _client.SendAsync(request);

        AssertRejectedBeforeDownstream(response, HttpStatusCode.Forbidden);
    }

    [Test]
    public async Task RecentlyAuthenticatedAdministratorReachesAccountingRoute()
    {
        _invocationProbe.Reset();
        using var request = CreatePlanRequest();
        request.Headers.Add("X-Test-Subject", "administrator-1");
        request.Headers.Add("X-Test-Role", "data-protection-administrator");
        request.Headers.Add("X-Test-Scope", "home-ledger.data-protection.admin");
        request.Headers.Add(
            "X-Test-Auth-Time",
            DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));

        using var response = await _client.SendAsync(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadGateway));
            Assert.That(_invocationProbe.Count, Is.GreaterThan(0));
            Assert.That(
                _invocationProbe.RequestUris,
                Has.Some.Contains("homebudget-accounting-api/data-protection/v1/plans"));
        });
    }

    private static HttpRequestMessage CreatePlanRequest() => new(
        HttpMethod.Post,
        new Uri(PlanPath, UriKind.Relative))
    {
        Content = JsonContent.Create(new
        {
            operationKind = "ledger-reset",
            ledgerId = "default"
        })
    };

    private static void AddAdministratorHeaders(
        HttpRequestMessage request,
        DateTimeOffset authenticationTime)
    {
        request.Headers.Add("X-Test-Subject", "administrator-1");
        request.Headers.Add("X-Test-Role", "data-protection-administrator");
        request.Headers.Add("X-Test-Scope", "home-ledger.data-protection.admin");
        request.Headers.Add(
            "X-Test-Auth-Time",
            authenticationTime.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));
    }

    private void AssertRejectedBeforeDownstream(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus)
    {
        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(expectedStatus));
            Assert.That(_invocationProbe.Count, Is.Zero);
        });
    }
}
