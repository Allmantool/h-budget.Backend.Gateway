namespace HomeBudget.Core.Options
{
    public record JwtOptions
    {
        public string Secret { get; init; }
    }
}
