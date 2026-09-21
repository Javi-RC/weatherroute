using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using WeatherRoute.Infrastructure.Routing;

namespace WeatherRoute.Api.Errors;

public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            OperationCanceledException => (StatusCodes.Status499ClientClosedRequest, "Client Closed Request"),
            GeocodingException => (StatusCodes.Status404NotFound, "Not Found"),
            HttpRequestException => (StatusCodes.Status502BadGateway, "Bad Gateway"),
            _ => (StatusCodes.Status500InternalServerError, "Internal Server Error")
        };

        if (exception is OperationCanceledException)
        {
            logger.LogInformation("Request cancelled for {Method} {Path}.",
                httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            logger.LogError(exception, "Exception mapped to HTTP {Status} for {Method} {Path}.",
                status, httpContext.Request.Method, httpContext.Request.Path);
        }

        httpContext.Response.StatusCode = status;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails =
            {
                Status = status,
                Title = title,
                Detail = status is StatusCodes.Status404NotFound or StatusCodes.Status502BadGateway
                    ? exception.Message
                    : "An unexpected error occurred."
            }
        });
    }
}