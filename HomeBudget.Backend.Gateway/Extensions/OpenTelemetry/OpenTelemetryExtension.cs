using System;
using System.Collections.Generic;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using OpenTelemetry.Exporter;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Core;
using HomeBudget.Core.Constants;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions.OpenTelemetry
{
    internal static class OpenTelemetryExtension
    {
        public static bool TryAddTracingSupport(
            this IServiceCollection services,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            string serviceName,
            string serviceVersion)
        {
            var telemetryEndpoint =
                configuration.GetValue<string>("ObservabilityOptions:TelemetryEndpoint");

            if (string.IsNullOrWhiteSpace(telemetryEndpoint))
            {
                return false;
            }

            var resourceBuilder = ResourceBuilder.CreateDefault()
                .AddService(
                    serviceName: serviceName,
                    serviceVersion: serviceVersion,
                    serviceInstanceId: Environment.MachineName)
                .AddAttributes(new Dictionary<string, object>
                {
                    [OpenTelemetryTags.DeploymentEnvironment] = environment.EnvironmentName
                });

            services
                .AddOpenTelemetry()
                .WithTracing(tracing =>
                {
                    tracing
                        .SetResourceBuilder(resourceBuilder)
                        .AddAspNetCoreInstrumentation(options =>
                        {
                            options.RecordException = true;

                            options.EnrichWithHttpRequest = (activity, request) =>
                            {
                                if (request.Headers.TryGetValue(
                                        HttpHeaderKeys.CorrelationId,
                                        out var correlationId))
                                {
                                    activity.SetTag(
                                        ActivityTags.CorrelationId,
                                        correlationId.ToString());
                                }
                            };

                            options.EnrichWithHttpResponse = (activity, response) =>
                            {
                                activity.SetTag(
                                    ActivityTags.HttpStatusCode,
                                    response.StatusCode);
                            };

                            options.EnrichWithException = (activity, exception) =>
                            {
                                activity.SetTag(
                                    ActivityTags.ExceptionMessage,
                                    exception.Message);
                            };
                        })
                        .AddHttpClientInstrumentation(options =>
                        {
                            options.RecordException = true;
                        })
                        .AddEntityFrameworkCoreInstrumentation()
                        .AddSqlClientInstrumentation(options =>
                        {
                            options.RecordException = true;
                        })
                        .AddSource(Observability.ActivitySourceName)
                        .AddSource(HostServiceOptions.Gateway)
                        .AddSource(environment.ApplicationName)
                        .AddOtlpExporter(options =>
                        {
                            options.Endpoint = new Uri(telemetryEndpoint);
                            options.Protocol = OtlpExportProtocol.Grpc;
                        });
                })

                .WithMetrics(metrics =>
                {
                    metrics
                        .SetResourceBuilder(resourceBuilder)
                        .AddAspNetCoreInstrumentation()
                        .AddHttpClientInstrumentation()
                        .AddRuntimeInstrumentation()
                        .AddMeter(MetersTags.Hosting)
                        .AddMeter(MetersTags.Routing)
                        .AddMeter(MetersTags.Diagnostics)
                        .AddMeter(MetersTags.Kestrel)
                        .AddMeter(MetersTags.HttpConnections)
                        .AddMeter(MetersTags.HealthChecks)
                        .SetMaxMetricStreams(OpenTelemetryOptions.MaxMetricStreams)
                        .AddPrometheusExporter();
                });

            return true;
        }

        public static IApplicationBuilder SetupOpenTelemetry(
            this IApplicationBuilder app)
        {
            app.UseOpenTelemetryPrometheusScrapingEndpoint();
            return app;
        }
    }
}
