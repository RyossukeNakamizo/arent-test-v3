using System.Net.Http.Headers;
using System.Text.Json;
using IssueManager.Api.Application.Interfaces;

namespace IssueManager.Api.Infrastructure.ApsProxy;

public class ApsTokenProvider : IApsTokenProvider
{
    private readonly HttpClient _http;
    private readonly string _clientId;
    private readonly string _clientSecret;

    private string? _cachedToken;
    private DateTime _tokenExpiry = DateTime.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ApsTokenProvider(HttpClient http, IConfiguration config)
    {
        _http = http;
        _clientId = config["APS_CLIENT_ID"] ?? throw new InvalidOperationException("APS_CLIENT_ID is required");
        _clientSecret = config["APS_CLIENT_SECRET"] ?? throw new InvalidOperationException("APS_CLIENT_SECRET is required");
    }

    public async Task<(string AccessToken, int ExpiresIn)> GetTokenAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            // Return cached token if still valid (60s buffer)
            if (_cachedToken is not null && DateTime.UtcNow < _tokenExpiry)
            {
                var remaining = (int)(_tokenExpiry - DateTime.UtcNow).TotalSeconds;
                return (_cachedToken, remaining);
            }

            // Request new token via 2-legged OAuth
            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://developer.api.autodesk.com/authentication/v2/token");
            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["scope"] = "data:read viewables:read"
            });
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($"{_clientId}:{_clientSecret}")));

            var response = await _http.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var accessToken = doc.RootElement.GetProperty("access_token").GetString()!;
            var expiresIn = doc.RootElement.GetProperty("expires_in").GetInt32();

            // Cache with 60s buffer
            _cachedToken = accessToken;
            _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn - 60);

            return (accessToken, expiresIn);
        }
        finally
        {
            _lock.Release();
        }
    }
}
