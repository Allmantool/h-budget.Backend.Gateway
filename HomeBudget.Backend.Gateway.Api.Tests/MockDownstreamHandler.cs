using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace HomeBudget.Backend.Gateway.Api.Tests
{
    internal class MockDownstreamHandler : DelegatingHandler
    {
        private static readonly string[] ObservedHeaders =
        [
            "Authorization",
            "Idempotency-Key",
            "If-Match",
            "CorrelationId",
            "traceparent",
            "tracestate",
            "baggage"
        ];

        private static int _cancellationObserved;
        private static int _requestCount;
        private static int _requestStarted;

        public bool CancellationObserved => Volatile.Read(ref _cancellationObserved) == 1;

        public bool RequestStarted => Volatile.Read(ref _requestStarted) == 1;

        public int RequestCount => Volatile.Read(ref _requestCount);

        public void Reset()
        {
            Interlocked.Exchange(ref _cancellationObserved, 0);
            Interlocked.Exchange(ref _requestCount, 0);
            Interlocked.Exchange(ref _requestStarted, 0);
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _requestCount);

            if (request.Headers.Contains("X-Test-Wait-For-Cancellation"))
            {
                Interlocked.Exchange(ref _requestStarted, 1);
                try
                {
                    await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    Interlocked.Exchange(ref _cancellationObserved, 1);
                    throw;
                }
            }

            var statusCode = GetRequestedStatusCode(request) ?? HttpStatusCode.Redirect;
            var response = new HttpResponseMessage(statusCode);
            response.Headers.Location = request.RequestUri;
            foreach (var headerName in ObservedHeaders)
            {
                EchoHeader(request, response, headerName);
            }

            return response;
        }

        private static void EchoHeader(
            HttpRequestMessage request,
            HttpResponseMessage response,
            string headerName)
        {
            if (request.Headers.TryGetValues(headerName, out var values))
            {
                response.Headers.TryAddWithoutValidation($"X-Observed-{headerName}", values);
            }
        }

        private static HttpStatusCode? GetRequestedStatusCode(HttpRequestMessage request)
        {
            if (request.Headers.TryGetValues("X-Test-Downstream-Status", out var values) &&
                int.TryParse(values.Single(), out var statusCode))
            {
                return (HttpStatusCode)statusCode;
            }

            return null;
        }
    }
}
