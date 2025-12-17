using HealthChecks.UI.Client;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Extensions.Logs;
using HomeBudget.Backend.Gateway.Middlewares;

namespace HomeBudget.Backend.Gateway.Configuration
{
    internal static class HealthCheckConfiguration
    {
        public static IServiceCollection SetUpHealthCheck(
            this IServiceCollection services,
            IConfiguration configuration,
            string hostUrls)
        {
            services
                .AddHealthChecks()
                .AddCheck("heartbeat", () => HealthCheckResult.Healthy())
                .AddCheck<CustomLogicHealthCheck>(nameof(CustomLogicHealthCheck), tags: ["custom"]);

            services.AddHealthChecksUI(setupSettings: setup =>
            {
                var endpoint = configuration.GetHealthCheckEndpoint(hostUrls);

                setup.AddHealthCheckEndpoint("[Gateway endpoint]", endpoint);
            }).AddInMemoryStorage();

            return services;
        }

        public static IApplicationBuilder SetUpHealthCheckEndpoints(
            this IApplicationBuilder builder,
            IWebHostEnvironment webHostEnvironment)
        {
            return builder.UseEndpoints(config =>
            {
                var options = new HealthCheckOptions
                {
                    Predicate = _ => true,
                    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
                };

                config.MapHealthChecks(Endpoints.HealthCheckSource, options);

                config.MapHealthChecksUI(options =>
                {
                    options.UIPath = Endpoints.HealthCheckUIPath;
                    options.ApiPath = Endpoints.HealthCheckUIApiPath;
                });
            });
        }
    }
}
