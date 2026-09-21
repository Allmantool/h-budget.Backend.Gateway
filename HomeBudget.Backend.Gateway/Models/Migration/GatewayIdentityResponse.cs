using System;

namespace HomeBudget.Backend.Gateway.Models.Migration;

public sealed record GatewayIdentityResponse(
    string Service,
    string Environment,
    string EnvironmentIdentity,
    string InstanceIdentity,
    int MigrationContractVersion,
    string BuildVersion,
    string Commit,
    DateTimeOffset TimestampUtc);
