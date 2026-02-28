using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Channels;

using Elastic.Apm.SerilogEnricher;
using Elastic.Channels;
using Elastic.Ingest.Elasticsearch;
using Elastic.Ingest.Elasticsearch.DataStreams;
using Elastic.Serilog.Sinks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Debugging;
using Serilog.Events;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Core.Constants;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway.Extensions.Logs
{
    internal static class LoggerConfigurationExtensions
    {
        public static LoggerConfiguration TryAddSeqSupport(this LoggerConfiguration loggerConfiguration, IConfiguration configuration)
        {
            try
            {
                var seqSection = configuration.GetSection(ConfigurationSectionKeys.SeqOptions);

                if (seqSection is null)
                {
                    return loggerConfiguration;
                }

                var seqOptions = configuration.GetSection(ConfigurationSectionKeys.SeqOptions).Get<SeqOptions>();

                if (seqOptions is null || !seqOptions.IsEnabled)
                {
                    return loggerConfiguration;
                }

                var seqUrl = seqOptions.Uri?.ToString() ?? Environment.GetEnvironmentVariable("SEQ_URL");

                loggerConfiguration.WriteTo.Seq(seqUrl, restrictedToMinimumLevel: LogEventLevel.Information);
            }
            catch (Exception ex)
            {
                SelfLog.WriteLine($"Failed to configure Seq sink: {ex}");
            }

            return loggerConfiguration;
        }

        public static LoggerConfiguration TryAddElasticSearchSupport(
            this LoggerConfiguration loggerConfiguration,
            IConfiguration configuration,
            IHostEnvironment environment)
        {
            try
            {
                var elasticSection = configuration.GetSection(ConfigurationSectionKeys.ElasticSearchOptions);

                if (elasticSection is null)
                {
                    return loggerConfiguration;
                }

                var elasticOptions = configuration.GetSection(ConfigurationSectionKeys.ElasticSearchOptions)?.Get<ElasticSearchOptions>();

                if (elasticOptions is null || !elasticOptions.IsEnabled)
                {
                    return loggerConfiguration;
                }

                var elasticNodeUrl = (elasticOptions.Uri?.ToString() ?? Environment.GetEnvironmentVariable(EnvironmentsVariables.AspNetCoreUrls)) ?? string.Empty;

                return string.IsNullOrWhiteSpace(elasticNodeUrl)
                    ? loggerConfiguration
                    : loggerConfiguration
                        .Enrich.WithElasticApmCorrelationInfo()
                        .WriteTo.Elasticsearch(
                            new List<Uri>
                            {
                                new(elasticNodeUrl)
                            },
                            opt => opt.ConfigureElasticSink(environment));
            }
            catch (Exception ex)
            {
                SelfLog.WriteLine($"Elasticsearch sink initialization failed: {ex}");
            }

            return loggerConfiguration;
        }

        private static void ConfigureElasticSink(
            this ElasticsearchSinkOptions options,
            IHostEnvironment environment)
        {
            var formattedExecuteAssemblyName = typeof(Program).Assembly.GetName().Name;
            var dateIndexPostfix = DateTime.UtcNow.ToString(DateFormats.ElasticSearch, CultureInfo.InvariantCulture);
            var baseStreamName = $"{formattedExecuteAssemblyName}-{environment.EnvironmentName}-{dateIndexPostfix}";

            var formattedStreamName = baseStreamName
                .Replace(".", "-", StringComparison.OrdinalIgnoreCase)
                .ToUpperInvariant();

            options.DataStream = new DataStreamName(formattedStreamName);
            options.BootstrapMethod = BootstrapMethod.Failure;
            options.MinimumLevel = LogEventLevel.Debug;
            options.ConfigureChannel = channelOpts =>
            {
                channelOpts.BufferOptions = new BufferOptions
                {
                    BoundedChannelFullMode = BoundedChannelFullMode.DropNewest,
                };
            };
        }
    }
}
