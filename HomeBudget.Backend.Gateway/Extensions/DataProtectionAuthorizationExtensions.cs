using System;
using System.Linq;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

using HomeBudget.Backend.Gateway.Authorization;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class DataProtectionAuthorizationExtensions
{
    public static WebApplicationBuilder AddDataProtectionAuthorization(
        this WebApplicationBuilder builder)
    {
        var section = builder.Configuration.GetSection(DataProtectionAuthorizationOptions.SectionName);
        var configured = section.Get<DataProtectionAuthorizationOptions>() ?? new();

        builder.Services.AddOptions<DataProtectionAuthorizationOptions>()
            .Bind(section)
            .ValidateOnStart();
        builder.Services.AddSingleton<IValidateOptions<DataProtectionAuthorizationOptions>,
            DataProtectionAuthorizationOptionsValidator>();

        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = DataProtectionAuthorizationDefaults.BearerScheme;
            options.DefaultChallengeScheme = DataProtectionAuthorizationDefaults.BearerScheme;
            options.DefaultForbidScheme = DataProtectionAuthorizationDefaults.BearerScheme;
        }).AddJwtBearer(DataProtectionAuthorizationDefaults.BearerScheme, options =>
        {
            options.Authority = NullIfEmpty(configured.Authority);
            options.Audience = NullIfEmpty(configured.Audience);
            options.RequireHttpsMetadata = configured.RequireHttpsMetadata;
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                RequireExpirationTime = true,
                RequireSignedTokens = true,
                RoleClaimType = "role",
                NameClaimType = "sub"
            };
        });

        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(
                DataProtectionAuthorizationDefaults.AdministratorPolicy,
                policy => ConfigureAdministratorPolicy(policy, configured, requireRecentAuthentication: false));

            options.AddPolicy(
                DataProtectionAuthorizationDefaults.RecentAdministratorPolicy,
                policy => ConfigureAdministratorPolicy(policy, configured, requireRecentAuthentication: true));
        });

        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<IAuthorizationHandler, RecentAuthenticationHandler>();

        return builder;
    }

    private static void ConfigureAdministratorPolicy(
        AuthorizationPolicyBuilder policy,
        DataProtectionAuthorizationOptions options,
        bool requireRecentAuthentication)
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole(options.AdministratorRole);
        policy.RequireAssertion(context => HasScope(context, options.RequiredScope));

        if (requireRecentAuthentication)
        {
            policy.AddRequirements(new RecentAuthenticationRequirement(
                TimeSpan.FromSeconds(options.RecentAuthenticationSeconds),
                TimeSpan.FromSeconds(options.FutureClockSkewSeconds)));
        }
    }

    private static bool HasScope(
        AuthorizationHandlerContext context,
        string requiredScope) => context.User.FindAll("scope")
            .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Contains(requiredScope, StringComparer.Ordinal);

    private static string NullIfEmpty(string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
