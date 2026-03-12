using System.IO;
using System.Text;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

using HomeBudget.Backend.Gateway.Constants;

namespace HomeBudget.Backend.Gateway.Middlewares
{
    public class RequestResponseLogging(RequestDelegate next, ILogger<RequestResponseLogging> logger)
    {
        public async Task InvokeAsync(HttpContext context)
        {
            context.Request.EnableBuffering();
            var builder = new StringBuilder();
            var request = await FormatRequestAsync(context.Request);
            builder.Append("Request: ").AppendLine(SanitizeForLogging(request));
            builder.AppendLine("Request headers:");

            foreach (var header in context.Request.Headers)
            {
                builder.Append(SanitizeForLogging(header.Key)).Append(": ").AppendLine(SanitizeForLogging(header.Value));
            }

            if (ServerSentEventsMiddleware.IsServerSentEventsRequest(context.Request))
            {
                builder.AppendLine("Skipping response body buffering for SSE request.");
                await next(context);
                logger.LogInformation(builder.ToString());
                return;
            }

            var originalBodyStream = context.Response.Body;
            using var responseBody = new MemoryStream();
            context.Response.Body = responseBody;
            await next(context);

            var response = await FormatResponseAsync(context.Response);
            builder.Append("Response: ").AppendLine(SanitizeForLogging(response));
            builder.AppendLine("Response headers: ");

            foreach (var header in context.Response.Headers)
            {
                builder.Append(SanitizeForLogging(header.Key)).Append(": ").AppendLine(SanitizeForLogging(header.Value));
            }

            logger.LogInformation(builder.ToString());

            await responseBody.CopyToAsync(originalBodyStream);
        }

        private static async Task<string> FormatRequestAsync(HttpRequest request)
        {
            using var reader = new StreamReader(
                request.Body,
                encoding: Encoding.UTF8,
                detectEncodingFromByteOrderMarks: false,
                leaveOpen: true);

            var body = await reader.ReadToEndAsync();
            var formattedRequest = $"{SanitizeForLogging(request.Method)} {SanitizeForLogging(request.Scheme)}://{SanitizeForLogging(request.Host.ToString())}{SanitizeForLogging(request.Path)}{SanitizeForLogging(request.QueryString.ToString())} {SanitizeForLogging(body)}";
            request.Body.Position = 0;

            return formattedRequest;
        }

        private static async Task<string> FormatResponseAsync(HttpResponse response)
        {
            response.Body.Seek(0, SeekOrigin.Begin);
            var text = await new StreamReader(response.Body).ReadToEndAsync();
            response.Body.Seek(0, SeekOrigin.Begin);

            return $"{response.StatusCode}: {SanitizeForLogging(text)}";
        }

        private static string SanitizeForLogging(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            return value
                .Replace("\r", " ")
                .Replace("\n", " ");
        }
    }
}
