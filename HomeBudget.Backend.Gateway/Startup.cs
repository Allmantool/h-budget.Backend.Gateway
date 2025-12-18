using System;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

using HomeBudget.Backend.Gateway.Configuration;
using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Extensions;
using HomeBudget.Backend.Gateway.Extensions.OpenTelemetry;
using HomeBudget.Backend.Gateway.Middlewares;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway
{
    public class Startup(IConfiguration configuration, IWebHostEnvironment hostEnvironment)
    {
        public IConfiguration HostConfiguration { get; } = configuration;
        public IWebHostEnvironment HostEnvironment { get; } = hostEnvironment;

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();

            services.AddOcelot(HostConfiguration);

            services.AddEndpointsApiExplorer()
                .SetUpHealthCheck(configuration, Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? Endpoints.HealthCheckSource)
                .AddResponseCaching();

            services.AddHeaderPropagation(options =>
            {
                options.Headers.Add(HttpHeaderKeys.HostService, HostServiceOptions.Gateway);
                options.Headers.Add(HttpHeaderKeys.CorrelationId);
            });

            services.InitializeOpenTelemetry(HostEnvironment);

            services.AddCors(options =>
            {
                options.AddPolicy(
                    "CorsPolicy",
                    builder => builder.AllowAnyOrigin()
                        .AllowAnyMethod()
                        .AllowAnyHeader());
            });
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.SetUpBaseApplication(env, configuration);
            app.SetupOpenTelemetry();
            app.UseMiddleware<OcelotLoggingMiddleware>();
            app.UseOcelot();

            app.Use(async (context, next) =>
            {
                var requestPath = context.Request.Path;

                if (string.IsNullOrWhiteSpace(requestPath))
                {
                    await next();
                }

                if (requestPath.StartsWithSegments(Endpoints.HealthCheckSource) ||
                    requestPath.StartsWithSegments(Endpoints.HealthCheckUIApiPath) ||
                    requestPath.StartsWithSegments(Endpoints.Metrics))
                {
                    await next();
                    return;
                }

                var httpsUrl = $"https://{context.Request.Host}{context.Request.Path}{context.Request.QueryString}";
                context.Response.Redirect(httpsUrl, permanent: false);
            });
        }
    }
}
