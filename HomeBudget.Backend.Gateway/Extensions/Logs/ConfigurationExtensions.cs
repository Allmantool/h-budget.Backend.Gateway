using Microsoft.Extensions.Configuration;

using HomeBudget.Backend.Gateway.Constants;

namespace HomeBudget.Backend.Gateway.Extensions.Logs
{
    internal static class ConfigurationExtensions
    {
        public static string GetHealthCheckEndpoint(this IConfiguration configuration, string hostUrls)
        {
            var hostFromConfiguration = configuration.GetRequiredSection("HealthCheckOptions:Host")?.Value;

            var healthCheckHost = string.IsNullOrWhiteSpace(hostFromConfiguration) ? hostUrls : hostFromConfiguration;

            return $"{healthCheckHost}{Endpoints.HealthCheckSource}";
        }
    }
}
