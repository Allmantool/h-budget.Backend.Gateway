namespace HomeBudget.Backend.Gateway.Models.Migration;

public sealed record MigrationPaymentCapability(
    bool RouteAvailable,
    bool IdempotencySupported,
    bool CommandStatusAvailable,
    bool ReadbackAvailable,
    bool MigrationSafe);
