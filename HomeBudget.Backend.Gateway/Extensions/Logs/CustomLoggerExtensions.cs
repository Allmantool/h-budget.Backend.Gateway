using Elastic.Apm.SerilogEnricher;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Logs;
using Serilog;
using Serilog.Core;
using Serilog.Enrichers.Span;
using Serilog.Events;
using Serilog.Exceptions;
using Serilog.Formatting.Compact;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions.Logs
{
    internal static class CustomLoggerExtensions
    {
        public static LoggerConfiguration ConfigureSerilog(
           this LoggerConfiguration logger,
           IConfiguration configuration,
           IHostEnvironment environment)
        {
            return logger
                  .ReadFrom.Configuration(configuration)
                  .Enrich.FromLogContext()
                  .Enrich.WithEnvironmentName()
                  .Enrich.WithProcessId()
                  .Enrich.WithProcessName()
                  .Enrich.WithExceptionDetails()
                  .Enrich.WithProperty(LoggerTags.Environment, environment.EnvironmentName)
                  .Enrich.WithProperty(LoggerTags.HostService, HostServiceOptions.Gateway)
                  .Enrich.WithProperty(LoggerTags.ApplicationName, environment.ApplicationName)
                  .Enrich.WithSpan()
                  .Enrich.WithActivityId()
                  .Enrich.WithActivityTags()
                  .Enrich.WithElasticApmCorrelationInfo()
                  .WriteTo.Debug()
                  .WriteTo.Console(
                      new RenderedCompactJsonFormatter(),
                      restrictedToMinimumLevel: LogEventLevel.Information)
                  .WriteTo.AddAndConfigureSentry(configuration, environment)
                  .TryAddSeqSupport(configuration)
                  .TryAddElasticSearchSupport(
                      configuration,
                      environment,
                      typeof(Program).Assembly.GetName().Name);
        }

        public static Logger InitializeLogger(
            this IConfiguration configuration,
            IHostEnvironment environment,
            ILoggingBuilder loggingBuilder)
        {
            var logger = new LoggerConfiguration()
                .ConfigureSerilog(configuration, environment)
                .CreateLogger();

            loggingBuilder.ClearProviders();
            loggingBuilder.AddSerilog(logger);

            loggingBuilder.AddOpenTelemetryMetrics();

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
