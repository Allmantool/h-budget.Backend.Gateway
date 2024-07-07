using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Rewrite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

using HomeBudget.Backend.Gateway.Extensions;
using HomeBudget.Backend.Gateway.Middlewares;
using HomeBudget.Core.Constants;
using HomeBudget.Core.Options;

namespace HomeBudget.Backend.Gateway
{
    public class Startup(IConfiguration configuration)
    {
        private IConfiguration Configuration { get; } = configuration;

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();

            services.AddOcelot(Configuration);

            services.AddJwt(Configuration); // JWT Configuration

            services.AddCors(options =>
            {
                options.AddPolicy(
                    "CorsPolicy",
                    builder => builder.AllowAnyOrigin()
                        .AllowAnyMethod()
                        .AllowAnyHeader());
            });

            services.AddHealthChecks()
                .AddMongoDb(
                    mongodbConnectionString: (
                        Configuration.GetSection(ConfigurationSectionKeys.MongoDbOptions).Get<MongoDbOptions>()
                        ?? throw new Exception("mongo configuration section not found")
                    ).ConnectionString,
                    name: "Mongo Db",
                    failureStatus: HealthStatus.Unhealthy
                );

            services.AddHealthChecksUI().AddInMemoryStorage();
        }

        public async Task Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseMiddleware<RequestResponseLogging>();

            app.UseCors("CorsPolicy");

            app.UseAuthentication();

            app.UseHealthChecks("/healthz", new HealthCheckOptions
            {
                Predicate = _ => true,
                ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
            });

            app.UseHealthChecksUI();

            var option = new RewriteOptions();
            option.AddRedirect("^$", "healthchecks-ui");
            app.UseRewriter(option);

            await app.UseOcelot();
        }
    }
}
