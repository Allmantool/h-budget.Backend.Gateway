using System;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Middlewares;

namespace HomeBudget.Backend.Gateway.Api.Tests
{
    [TestFixture]
    internal sealed class HttpsRedirectionTests
    {
        [Test]
        public async Task Http_Request_To_Regular_Endpoint_Should_Redirect_To_Https()
        {
            var context = await InvokeMiddlewareAsync("/swagger");

            Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status302Found));
            Assert.That(context.Response.Headers.Location, Is.EqualTo("https://localhost/swagger"));
        }

        [TestCase(Endpoints.HealthCheckSource)]
        [TestCase(Endpoints.Metrics)]
        public async Task Http_Request_To_Internal_Endpoints_Should_Not_Redirect(string path)
        {
            var context = await InvokeMiddlewareAsync(path);

            Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status204NoContent));
            Assert.That(context.Response.Headers.Location, Is.Empty);
        }

        private static async Task<DefaultHttpContext> InvokeMiddlewareAsync(string path)
        {
            var context = new DefaultHttpContext();
            context.Request.Scheme = Uri.UriSchemeHttp;
            context.Request.Host = new HostString("localhost");
            context.Request.Path = path;

            var middleware = new HttpsEnforcementMiddleware(next =>
            {
                next.Response.StatusCode = StatusCodes.Status204NoContent;
                return Task.CompletedTask;
            });

            await middleware.InvokeAsync(context);
            return context;
        }
    }
}
