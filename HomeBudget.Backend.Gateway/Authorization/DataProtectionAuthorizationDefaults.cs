namespace HomeBudget.Backend.Gateway.Authorization;

internal static class DataProtectionAuthorizationDefaults
{
    public const string AdministratorPolicy = "DataProtectionAdministrator";
    public const string BearerScheme = "DataProtectionBearer";
    public const string PathPrefix = "/gateway/accounting/data-protection/v1";
    public const string RecentAdministratorPolicy = "DataProtectionRecentlyAuthenticatedAdministrator";
}
