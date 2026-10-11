namespace HomeBudget.Backend.Gateway.Authorization;

internal sealed class DataProtectionAuthorizationOptions
{
    public const string SectionName = "DataProtectionAuthorization";

    public bool Enabled { get; init; }

    public string Authority { get; init; } = string.Empty;

    public string Audience { get; init; } = string.Empty;

    public string AdministratorRole { get; init; } = "data-protection-administrator";

    public string RequiredScope { get; init; } = "home-ledger.data-protection.admin";

    public int RecentAuthenticationSeconds { get; init; } = 900;

    public int FutureClockSkewSeconds { get; init; } = 60;

    public bool RequireHttpsMetadata { get; init; } = true;
}
