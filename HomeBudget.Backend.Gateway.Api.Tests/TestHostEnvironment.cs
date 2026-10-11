using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace HomeBudget.Backend.Gateway.Api.Tests;

internal sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = environmentName;

    public string ApplicationName { get; set; } = "HomeBudget.Backend.Gateway.Api.Tests";

    public string ContentRootPath { get; set; } = string.Empty;

    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
