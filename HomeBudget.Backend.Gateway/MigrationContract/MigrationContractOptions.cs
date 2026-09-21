namespace HomeBudget.Backend.Gateway.MigrationContract;

public sealed class MigrationContractOptions
{
    public const string SectionName = "MigrationContract";

    public string EnvironmentIdentity { get; set; } = string.Empty;

    public string InstanceIdentity { get; set; } = string.Empty;

    public string Commit { get; set; } = string.Empty;
}
