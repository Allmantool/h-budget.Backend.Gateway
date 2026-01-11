using System;

using Elastic.Apm.SerilogEnricher;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Logs;
using Serilog;
using Serilog.Core;
using Serilog.Enrichers.Span;
using Serilog.Events;
using Serilog.Exceptions;
using Serilog.Formatting.Compact;
using Serilog.Sinks.OpenTelemetry;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions.Logs
{
    internal static class CustomLoggerExtensions
    {
        public static LoggerConfiguration ConfigureSerilog(
           this LoggerConfiguration logger,
           IConfiguration configuration,
           IWebHostEnvironment environment)
        {
            return logger
                .ReadFrom.Configuration(configuration)
                .Enrich.FromLogContext()
                .Enrich.WithEnvironmentName()
                .Enrich.WithProcessId()
                .Enrich.WithProcessName()
                .Enrich.WithExceptionDetails()
                .Enrich.WithProperty(LoggerTags.MachineName, Environment.MachineName)
                .Enrich.WithProperty(LoggerTags.Environment, environment.EnvironmentName)
                .Enrich.WithProperty(LoggerTags.HostService, HostServiceOptions.Gateway)
                .Enrich.WithProperty(LoggerTags.ApplicationName, environment.ApplicationName)
                .Enrich.WithSpan()
                .Enrich.WithActivityId()
                .Enrich.WithActivityTags()
                .WriteTo.Debug()
                .WriteTo.Console(
                    new RenderedCompactJsonFormatter(),
                    restrictedToMinimumLevel: LogEventLevel.Information)
                .WriteTo.AddAndConfigureSentry(configuration, environment)
                .WriteTo.OpenTelemetry(o =>
                {
                    o.Endpoint = configuration.GetSection("ObservabilityOptions:LogsEndpoint")?.Value;
                    o.Protocol = OtlpProtocol.Grpc;
                })
                .Enrich.WithElasticApmCorrelationInfo()
                .TryAddSeqSupport(configuration)
                .TryAddElasticSearchSupport(configuration, environment, typeof(Program).Assembly.GetName().Name);
        }

        public static Logger InitializeLogger(
            this IConfiguration configuration,
            IWebHostEnvironment environment,
            ILoggingBuilder loggingBuilder,
            ConfigureHostBuilder host,
            string hostServiceName)
        {
            var logger = new LoggerConfiguration()
                .ConfigureSerilog(configuration, environment)
                .CreateLogger();

            loggingBuilder.ClearProviders();
            loggingBuilder.AddSerilog(logger);

            loggingBuilder.AddOpenTelemetry(options =>
            {
                options.IncludeScopes = true;
                options.ParseStateValues = true;
                options.IncludeFormattedMessage = true;
                options.AddOtlpExporter();
            });

            Log.Logger = logger;

            return logger;
        }

        public static ILoggingBuilder AddOpenTelemetryMetrics(
            this ILoggingBuilder loggingBuilder)
        {
            return loggingBuilder.AddOpenTelemetry(options =>
            {
                options.IncludeScopes = true;
                options.ParseStateValues = true;
                options.IncludeFormattedMessage = true;
                options.AddOtlpExporter();
            });
        }

        public static WebApplication SetupHttpLogging(this WebApplication app)
        {
            app.UseSerilogRequestLogging(options =>
            {
                options.EnrichDiagnosticContext = LogEnricher.HttpRequestEnricher;
            });

            return app;
        }
    }
}
