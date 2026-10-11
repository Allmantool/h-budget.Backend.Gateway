using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;

namespace HomeBudget.Backend.Gateway.Api.Tests;

internal sealed class DownstreamInvocationProbe : IDisposable
{
    private readonly ActivityListener _listener;
    private readonly ConcurrentQueue<string> _requestUris = new();
    private int _count;

    public DownstreamInvocationProbe()
    {
        _listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "System.Net.Http",
            Sample = static (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllData,
            ActivityStopped = RecordRequestUri
        };

        ActivitySource.AddActivityListener(_listener);
    }

    public int Count => Volatile.Read(ref _count);

    public IReadOnlyCollection<string> RequestUris => _requestUris.ToArray();

    public void Dispose() => _listener.Dispose();

    public void Reset()
    {
        Interlocked.Exchange(ref _count, 0);
        _requestUris.Clear();
    }

    private void RecordRequestUri(Activity activity)
    {
        var requestUri = activity.GetTagItem("url.full")?.ToString() ??
            activity.GetTagItem("http.url")?.ToString();
        if (!string.IsNullOrEmpty(requestUri))
        {
            _requestUris.Enqueue(requestUri);
            if (requestUri.Contains("homebudget-accounting-api", StringComparison.OrdinalIgnoreCase))
            {
                Interlocked.Increment(ref _count);
            }
        }
    }
}
