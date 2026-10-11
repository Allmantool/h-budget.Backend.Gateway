using System.Threading;
using System.Threading.Tasks;

using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace HomeBudget.Backend.Gateway.Authorization;

internal sealed class DataProtectionAuthorizationHealthCheck(
    IOptionsMonitor<DataProtectionAuthorizationOptions> options,
    IValidateOptions<DataProtectionAuthorizationOptions> validator)
    : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var current = options.CurrentValue;
            if (!current.Enabled)
            {
                return Task.FromResult(HealthCheckResult.Healthy("Data-protection routes are disabled."));
            }

            var validation = validator.Validate(Options.DefaultName, current);
            return Task.FromResult(validation.Succeeded
                ? HealthCheckResult.Healthy("Data-protection authorization is configured.")
                : HealthCheckResult.Unhealthy(string.Join(" ", validation.Failures)));
        }
        catch (OptionsValidationException exception)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy(
                "Data-protection authorization configuration is invalid.",
                exception));
        }
    }
}
