using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Mvc.Testing;

using HomeBudget.Backend.Gateway.Constants;

namespace HomeBudget.Backend.Gateway.Api.Tests
{
    [TestFixture]
    public class HttpsRedirectionTests
    {
        private GatewayWebApplicationFactory _factory = null!;
        private HttpClient _client = null!;

        [SetUp]
        public void Setup()
        {
            _factory = new GatewayWebApplicationFactory();

            _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                BaseAddress = new Uri("http://localhost")
            });
        }

        [TearDown]
        public void TearDown()
        {
            _client.Dispose();
            _factory.Dispose();
        }

        [Test]
        public async Task Http_Request_To_Regular_Endpoint_Should_Redirect_To_Https()
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/swagger");

            var response = await _client.SendAsync(request);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Redirect));

            var location = response.Headers.Location;
            Assert.That(location, Is.Not.Null);

            var redirectUri = location!.IsAbsoluteUri
                ? location
                : new Uri(_client.BaseAddress!, location);

            Assert.That(redirectUri.Scheme, Is.EqualTo("https"));
            Assert.That(redirectUri.AbsolutePath, Is.EqualTo("/swagger"));
        }

        [TestCase(Endpoints.HealthCheckSource)]
        [TestCase(Endpoints.Metrics)]
        public async Task Http_Request_To_Internal_Endpoints_Should_Not_Redirect(string path)
        {
            using var response = await _client.GetAsync(path);

            Assert.That(response.StatusCode, Is.Not.EqualTo(HttpStatusCode.Redirect));
            Assert.That(response.StatusCode, Is.Not.EqualTo(HttpStatusCode.MovedPermanently));
        }
    }
}
