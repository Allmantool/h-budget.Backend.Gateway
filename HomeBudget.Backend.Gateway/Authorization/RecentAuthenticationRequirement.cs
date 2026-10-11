using System;

using Microsoft.AspNetCore.Authorization;

namespace HomeBudget.Backend.Gateway.Authorization;

internal sealed class RecentAuthenticationRequirement : IAuthorizationRequirement
{
    public RecentAuthenticationRequirement(
        TimeSpan maximumAge,
        TimeSpan futureClockSkew)
    {
        MaximumAge = maximumAge;
        FutureClockSkew = futureClockSkew;
    }

    public TimeSpan MaximumAge { get; }

    public TimeSpan FutureClockSkew { get; }
}
