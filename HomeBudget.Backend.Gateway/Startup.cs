using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

using HomeBudget.Backend.Gateway.Middlewares;
using HomeBudget.Backend.Gateway.Models;

namespace HomeBudget.Backend.Gateway
{
    public class Startup(IConfiguration configuration)
    {
        private IConfiguration Configuration { get; } = configuration;

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();

            services.AddOcelot(Configuration);

            services.AddEndpointsApiExplorer();

            services.AddCors(options =>
            {
                options.AddPolicy(
                    "CorsPolicy",
                    builder => builder.AllowAnyOrigin()
                        .AllowAnyMethod()
                        .AllowAnyHeader());
            });

            services.AddHttpsRedirection(options =>
            {
                var sslOptions = configuration.GetSection(nameof(SslOptions)).Get<SslOptions>();

                options.RedirectStatusCode = StatusCodes.Status307TemporaryRedirect;
                options.HttpsPort = sslOptions.Port;
            });
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseCors("CorsPolicy");
            app.UseHttpsRedirection();
            app.UseOcelot();
            app.UseMiddleware<OcelotLoggingMiddleware>();
        }
    }
}
