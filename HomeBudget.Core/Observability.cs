using System.Diagnostics;

namespace HomeBudget.Core
{
    public static class Observability
    {
        public static readonly string ActivitySourceName = "HomeBudget.Gateway";
        public static readonly ActivitySource ActivitySource =
            new(ActivitySourceName);
    }
}
