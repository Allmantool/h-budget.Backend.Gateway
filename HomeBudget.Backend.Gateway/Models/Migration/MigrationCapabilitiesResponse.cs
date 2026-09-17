namespace HomeBudget.Backend.Gateway.Models.Migration;

public sealed record MigrationCapabilitiesResponse(
    int MigrationContractVersion,
    MigrationResourceCapability Accounts,
    MigrationResourceCapability Categories,
    MigrationResourceCapability Contractors,
    MigrationPaymentCapability Payments,
    MigrationTransferCapability Transfers,
    MigrationAdjustmentCapability MigrationAdjustments);
