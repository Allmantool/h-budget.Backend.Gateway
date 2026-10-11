using System;
using System.Collections.Generic;

using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace HomeBudget.Backend.Gateway.Authorization;

internal sealed class DataProtectionAuthorizationOptionsValidator(
    IHostEnvironment environment)
    : IValidateOptions<DataProtectionAuthorizationOptions>
{
    private const int MaximumRecentAuthenticationSeconds = 3600;
    private const int MaximumFutureClockSkewSeconds = 300;

    public ValidateOptionsResult Validate(
        string name,
        DataProtectionAuthorizationOptions options)
    {
        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        var failures = GetFailures(options);
        return failures.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(failures);
    }

    private List<string> GetFailures(DataProtectionAuthorizationOptions options)
    {
        var failures = new List<string>();

        if (!Uri.TryCreate(options.Authority, UriKind.Absolute, out var authority))
        {
            failures.Add("DataProtectionAuthorization:Authority must be an absolute URI when enabled.");
        }
        else if (environment.IsProduction() && authority.Scheme != Uri.UriSchemeHttps)
        {
            failures.Add("DataProtectionAuthorization:Authority must use HTTPS in Production.");
        }

        RequireValue(options.Audience, "Audience", failures);
        RequireValue(options.AdministratorRole, "AdministratorRole", failures);
        RequireValue(options.RequiredScope, "RequiredScope", failures);

        if (options.RecentAuthenticationSeconds is < 1 or > MaximumRecentAuthenticationSeconds)
        {
            failures.Add("DataProtectionAuthorization:RecentAuthenticationSeconds must be between 1 and 3600.");
        }

        if (options.FutureClockSkewSeconds is < 0 or > MaximumFutureClockSkewSeconds)
        {
            failures.Add("DataProtectionAuthorization:FutureClockSkewSeconds must be between 0 and 300.");
        }

        if (environment.IsProduction() && !options.RequireHttpsMetadata)
        {
            failures.Add("DataProtectionAuthorization:RequireHttpsMetadata must be true in Production.");
        }

        return failures;
    }

    private static void RequireValue(
        string value,
        string propertyName,
        List<string> failures)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            failures.Add($"DataProtectionAuthorization:{propertyName} is required when enabled.");
        }
    }
}
