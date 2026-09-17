using System;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

using HomeBudget.Backend.Gateway.MigrationContract;
using HomeBudget.Backend.Gateway.Models.Migration;

namespace HomeBudget.Backend.Gateway.Controllers;

[ApiController]
public sealed class GatewayMetadataController(
    IWebHostEnvironment environment,
    IOptions<MigrationContractOptions> options) : ControllerBase
{
    [HttpGet("/gateway/meta/identity")]
    public ActionResult<GatewayIdentityResponse> GetIdentity()
    {
        var configured = options.Value;
        var version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "unknown";
        return new GatewayIdentityResponse(
            MigrationContractDefinition.Service,
            environment.EnvironmentName,
            configured.EnvironmentIdentity,
            configured.InstanceIdentity,
            MigrationContractDefinition.Version,
            version,
            configured.Commit,
            DateTimeOffset.UtcNow);
    }

    [HttpGet("/gateway/accounting/meta/migration-capabilities")]
    public ActionResult<MigrationCapabilitiesResponse> GetMigrationCapabilities() => new MigrationCapabilitiesResponse(
        MigrationContractDefinition.Version,
        new(true, true, true, true),
        new(true, true, true, true),
        new(true, true, true, true),
        new(true, true, true, true, true),
        new(true, true, true, true, true, true),
        new("ordinaryPayment", true, true, true));
}
