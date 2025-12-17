using Microsoft.Extensions.Configuration;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Core.Constants;

namespace HomeBudget.Backend.Gateway.Extensions.Logs
{
    internal static class ConfigurationExtensions
    {
        public static string GetHealthCheckEndpoint(this IConfiguration configuration, string hostUrl)
        {
            if (Endpoints.HealthCheckSource.Equals(hostUrl, System.StringComparison.OrdinalIgnoreCase))
            {
                return Endpoints.HealthCheckSource;
            }

            var healCheckSection = configuration.GetRequiredSection(ConfigurationSectionKeys.HealthCHeckHost);

            if (healCheckSection is null)
            {
                return hostUrl;
            }

            var hostFromConfiguration = healCheckSection.Value;

            var healthCheckHost = string.IsNullOrWhiteSpace(hostFromConfiguration) ? hostUrl : hostFromConfiguration;

            return $"{healthCheckHost}{Endpoints.HealthCheckSource}";
        }
    }
}
