using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Serilog;
using Serilog.Events;

using HomeBudget.Backend.Gateway.Configuration;
using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Middlewares;
using HomeBudget.Core.Constants;

namespace HomeBudget.Backend.Gateway.Extensions
{
    internal static class ApplicationBuilderExtensions
    {
        public static IApplicationBuilder SetUpBaseApplication(
            this IApplicationBuilder app,
            IWebHostEnvironment env,
            IConfiguration configuration)
        {
            Log.Information("Current env is '{0}'.", env.EnvironmentName);

            if (env.IsUnderDevelopment())
            {
                app.UseDeveloperExceptionPage();

                app.UseCors(corsPolicyBuilder =>
                {
                    var allowedUiOrigins = configuration.GetSection(ConfigurationSectionKeys.UiHost).Get<string[]>();

                    Log.Information("UI origin is '{0}'", string.Join(" ,", allowedUiOrigins));

                    corsPolicyBuilder
                        .WithOrigins(allowedUiOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .WithExposedHeaders(HttpHeaderKeys.CorrelationId);
                });
            }

            return app
                .UseHsts()
                .UseResponseCaching()
                .UseAuthorization()
                .UseCorrelationId()
                .UseHeaderPropagation()
                .UseRouting()
                .UseSerilogRequestLogging(options =>
                {
                    options.MessageTemplate = "Handled {RequestPath}";

                    options.GetLevel = (_, _, _) => LogEventLevel.Debug;

                    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
                    {
                        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
                        diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
                    };
                })
                .SetUpHealthCheckEndpoints(env)
                .UseEndpoints(endpoints =>
                {
                    endpoints.MapControllers();
                });
        }
    }
}
