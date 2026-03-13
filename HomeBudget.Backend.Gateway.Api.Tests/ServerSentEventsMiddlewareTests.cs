using System.IO;
using System.IO.Pipelines;
using System.Threading;
using System.Threading.Tasks;

using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

using HomeBudget.Backend.Gateway.Constants;
using HomeBudget.Backend.Gateway.Middlewares;

namespace HomeBudget.Backend.Gateway.Api.Tests;

[TestFixture]
public class ServerSentEventsMiddlewareTests
{
    [Test]
    public async Task Should_DisableBuffering_And_SetStreamingHeaders_ForSseRequest()
    {
        var context = new DefaultHttpContext();
        var responseBodyFeature = new TrackingResponseBodyFeature();

        context.Features.Set<IHttpResponseBodyFeature>(responseBodyFeature);
        context.Request.Headers[HttpHeaderKeys.Accept] = "text/event-stream";

        var middleware = new ServerSentEventsMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Assert.Multiple(() =>
        {
            responseBodyFeature.DisableBufferingCalled.Should().BeTrue();
            context.Request.Headers[HttpHeaderKeys.AcceptEncoding].ToString().Should().Be("identity");
            context.Response.Headers[HttpHeaderKeys.CacheControl].ToString().Should().Be("no-cache, no-store");
            context.Response.Headers[HttpHeaderKeys.Pragma].ToString().Should().Be("no-cache");
            context.Response.Headers[HttpHeaderKeys.Expires].ToString().Should().Be("0");
            context.Response.Headers[HttpHeaderKeys.XAccelBuffering].ToString().Should().Be("no");
        });
    }

    [Test]
    public async Task Should_Not_Modify_NonSseRequest()
    {
        var context = new DefaultHttpContext();
        var responseBodyFeature = new TrackingResponseBodyFeature();

        context.Features.Set<IHttpResponseBodyFeature>(responseBodyFeature);
        context.Request.Headers[HttpHeaderKeys.Accept] = "application/json";

        var middleware = new ServerSentEventsMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Assert.Multiple(() =>
        {
            responseBodyFeature.DisableBufferingCalled.Should().BeFalse();
            context.Request.Headers.ContainsKey(HttpHeaderKeys.AcceptEncoding).Should().BeFalse();
            context.Response.Headers.ContainsKey(HttpHeaderKeys.CacheControl).Should().BeFalse();
            context.Response.Headers.ContainsKey(HttpHeaderKeys.XAccelBuffering).Should().BeFalse();
        });
    }

    private sealed class TrackingResponseBodyFeature : IHttpResponseBodyFeature
    {
        public Stream Stream { get; } = new MemoryStream();

        public PipeWriter Writer => throw new System.NotSupportedException();

        public bool DisableBufferingCalled { get; private set; }

        public void DisableBuffering()
        {
            DisableBufferingCalled = true;
        }

        public Task CompleteAsync()
        {
            return Task.CompletedTask;
        }

        public Task SendFileAsync(string path, long offset, long? count, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task StartAsync(CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }
}
