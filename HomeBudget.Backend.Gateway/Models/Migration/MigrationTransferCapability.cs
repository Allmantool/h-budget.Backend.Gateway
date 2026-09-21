namespace HomeBudget.Backend.Gateway.Models.Migration;

public sealed record MigrationTransferCapability(
    bool RouteAvailable,
    bool Idempotent,
    bool AtomicAcceptance,
    bool CommandStatusAvailable,
    bool TwoSideReadbackAvailable,
    bool MigrationSafe);
