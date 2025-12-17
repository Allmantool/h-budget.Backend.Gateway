namespace HomeBudget.Core.Constants
{
    public static class ConfigurationSectionKeys
    {
        public static readonly string Jwt = nameof(Jwt);
        public static readonly string MongoDbOptions = nameof(MongoDbOptions);
        public static readonly string ElasticSearchOptions = nameof(ElasticSearchOptions);
        public static readonly string SeqOptions = nameof(SeqOptions);
        public static readonly string HealthCHeckHost = "HealthCheckOptions:Host";
        public static readonly string UiHost = "UiOriginsUrl";
    }
}
