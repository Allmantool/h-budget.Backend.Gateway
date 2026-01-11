using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace HomeBudget.Backend.Gateway.Infrastructure;

internal interface IKestrelConfigurator
{
    void Configure(
        WebHostBuilderContext context,
        KestrelServerOptions options);
}
