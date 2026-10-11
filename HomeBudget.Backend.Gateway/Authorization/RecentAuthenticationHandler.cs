using System;
using System.Globalization;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authorization;

namespace HomeBudget.Backend.Gateway.Authorization;

internal sealed class RecentAuthenticationHandler(
    TimeProvider timeProvider)
    : AuthorizationHandler<RecentAuthenticationRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        RecentAuthenticationRequirement requirement)
    {
        var authTimeValue = context.User.FindFirst("auth_time")?.Value;
        if (!long.TryParse(authTimeValue, NumberStyles.None, CultureInfo.InvariantCulture, out var authTimeSeconds))
        {
            return Task.CompletedTask;
        }

        DateTimeOffset authTime;
        try
        {
            authTime = DateTimeOffset.FromUnixTimeSeconds(authTimeSeconds);
        }
        catch (ArgumentOutOfRangeException)
        {
            return Task.CompletedTask;
        }

        var now = timeProvider.GetUtcNow();
        if (authTime <= now.Add(requirement.FutureClockSkew) &&
            authTime >= now.Subtract(requirement.MaximumAge))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
