namespace HomeBudget.Backend.Gateway.Models.Migration;

public sealed record MigrationResourceCapability(
    bool RouteAvailable,
    bool ReadbackAvailable,
    bool IdempotentCreate,
    bool MigrationSafe);
