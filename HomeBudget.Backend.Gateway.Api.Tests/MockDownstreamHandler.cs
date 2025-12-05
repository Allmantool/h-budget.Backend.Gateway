using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace HomeBudget.Backend.Gateway.Api.Tests
{
    public class MockDownstreamHandler : DelegatingHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.Redirect);
            response.Headers.Location = request.RequestUri;

            return Task.FromResult(response);
        }
    }
}
