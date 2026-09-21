using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WeatherRoute.Infrastructure.Tests;

public sealed class StubHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, string> _responder;

    public StubHandler(Func<HttpRequestMessage, string> responder) => _responder = responder;

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = _responder(request);
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        return Task.FromResult(response);
    }
}