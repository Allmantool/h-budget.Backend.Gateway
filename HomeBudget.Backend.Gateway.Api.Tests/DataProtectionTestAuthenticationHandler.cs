using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HomeBudget.Backend.Gateway.Api.Tests;

internal sealed class DataProtectionTestAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "DataProtectionTest";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-Subject", out var subjects))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, subjects.ToString())
        };

        AddClaimIfPresent(claims, ClaimTypes.Role, "X-Test-Role");
        AddClaimIfPresent(claims, "scope", "X-Test-Scope");
        AddClaimIfPresent(claims, "auth_time", "X-Test-Auth-Time");

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }

    private void AddClaimIfPresent(
        List<Claim> claims,
        string claimType,
        string headerName)
    {
        if (Request.Headers.TryGetValue(headerName, out var values))
        {
            claims.Add(new Claim(claimType, values.ToString()));
        }
    }
}
