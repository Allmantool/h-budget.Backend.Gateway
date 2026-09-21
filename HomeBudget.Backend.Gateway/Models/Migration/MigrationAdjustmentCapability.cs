namespace HomeBudget.Backend.Gateway.Models.Migration;

public sealed record MigrationAdjustmentCapability(
    string Mechanism,
    bool PaymentMechanismSafe,
    bool ReferencePrerequisitesSafe,
    bool MigrationSafe);
