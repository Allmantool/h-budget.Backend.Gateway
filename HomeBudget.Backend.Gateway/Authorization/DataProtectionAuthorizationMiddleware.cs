using System;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace HomeBudget.Backend.Gateway.Authorization;

internal sealed class DataProtectionAuthorizationMiddleware(
    RequestDelegate next,
    IOptionsMonitor<DataProtectionAuthorizationOptions> options,
    IAuthorizationService authorizationService)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments(
                DataProtectionAuthorizationDefaults.PathPrefix,
                StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        if (!options.CurrentValue.Enabled)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var policy = HttpMethods.IsGet(context.Request.Method)
            ? DataProtectionAuthorizationDefaults.AdministratorPolicy
            : DataProtectionAuthorizationDefaults.RecentAdministratorPolicy;

        var result = await authorizationService.AuthorizeAsync(
            context.User,
            context,
            policy);

        if (result.Succeeded)
        {
            await next(context);
            return;
        }

        if (context.User.Identity?.IsAuthenticated == true)
        {
            await context.ForbidAsync();
        }
        else
        {
            await context.ChallengeAsync();
        }
    }
}
