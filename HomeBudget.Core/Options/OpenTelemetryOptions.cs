namespace HomeBudget.Core.Options
{
    public static class OpenTelemetryOptions
    {
        public static readonly int MaxMetricStreams = 500;
        public static readonly int MaxMetricPointsPerMetricStream = 200;
    }
}
