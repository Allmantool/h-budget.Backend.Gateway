using System.Threading.Tasks;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using Ocelot.Middleware;

using HomeBudget.Backend.Gateway.Middlewares;

namespace HomeBudget.Backend.Gateway.Extensions;

internal static class GatewayPipelineExtensions
{
    public static async Task<WebApplication> UseGatewayPipelineAsync(
        this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseHsts();
        }

        app.SetUpBaseApplication(app.Environment, app.Configuration);

        app.UseForwardedHeaders();

        if (!app.Environment.IsDevelopment())
        {
            app.UseMiddleware<HttpsEnforcementMiddleware>();
        }

        app.UseCors("CorsPolicy");
        app.UseWebSockets();
        app.UseMiddleware<ServerSentEventsMiddleware>();
        app.UseMiddleware<OcelotLoggingMiddleware>();

        await app.UseOcelot();

        return app;
    }
}
