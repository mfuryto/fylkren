using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace Fylkren.Api.ArtificialIntelligence;

internal sealed class AiProviderClient(IHttpClientFactory clients, IDataProtectionProvider protection)
{
    private readonly IDataProtector protector = protection.CreateProtector(Platform.ProtectedValuePurposes.AiProviderApiKey);
    internal string? Protect(string? value) => string.IsNullOrWhiteSpace(value) ? null : protector.Protect(value.Trim());
    internal string? Unprotect(string? value) => value is null ? null : protector.Unprotect(value);
    internal async Task<string> Complete(AiSettings settings, string systemPrompt, string userPrompt, CancellationToken ct)
    {
        using var request = CreateRequest(settings, systemPrompt, userPrompt, stream: false);
        using var response = await clients.CreateClient("ai-provider").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.TooManyRequests)
            throw new AiProviderRateLimitException(RetryAfterSeconds(response.Headers.RetryAfter));
        if (!response.IsSuccessStatusCode) throw new AiProviderHttpException((int)response.StatusCode);
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var content = json.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(content)) throw new HttpRequestException("AI provider returned an empty response.");
        return content.Length <= 20_000 ? content : content[..20_000];
    }

    internal async Task<AiProviderStream> Stream(AiSettings settings, string systemPrompt, string userPrompt, CancellationToken ct)
    {
        var request = CreateRequest(settings, systemPrompt, userPrompt, stream: true);
        try
        {
            var response = await clients.CreateClient("ai-provider").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                var retryAfter = RetryAfterSeconds(response.Headers.RetryAfter);
                response.Dispose();
                throw new AiProviderRateLimitException(retryAfter);
            }
            if (!response.IsSuccessStatusCode)
            {
                var status = (int)response.StatusCode;
                response.Dispose();
                throw new AiProviderHttpException(status);
            }
            return new AiProviderStream(response);
        }
        finally { request.Dispose(); }
    }

    private HttpRequestMessage CreateRequest(AiSettings settings, string systemPrompt, string userPrompt, bool stream)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, settings.EndpointUrl);
        var key = Unprotect(settings.ProtectedApiKey);
        if (key is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            model = settings.Model, temperature = 0.2, max_tokens = 1400, stream,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = $"{userPrompt}\n\n/no_think" }
            }
        }), Encoding.UTF8, "application/json");
        return request;
    }

    private static int? RetryAfterSeconds(RetryConditionHeaderValue? value)
    {
        var delay = value?.Delta ?? (value?.Date is { } date ? date - DateTimeOffset.UtcNow : null);
        return delay is null ? null : Math.Clamp((int)Math.Ceiling(delay.Value.TotalSeconds), 1, 86_400);
    }
}

internal sealed class AiProviderStream(HttpResponseMessage response) : IAsyncDisposable
{
    internal bool Completed { get; private set; }
    internal async IAsyncEnumerable<string> Read([EnumeratorCancellation] CancellationToken ct)
    {
        await using var content = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(content);
        while (await reader.ReadLineAsync(ct) is { } line)
        {
            if (!line.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) continue;
            var payload = line[5..].Trim();
            if (payload.Length == 0) continue;
            if (payload == "[DONE]") { Completed = true; yield break; }
            using var json = JsonDocument.Parse(payload);
            if (!json.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0) continue;
            var choice = choices[0];
            if (!choice.TryGetProperty("delta", out var delta) || !delta.TryGetProperty("content", out var contentElement) || contentElement.ValueKind != JsonValueKind.String) continue;
            var text = contentElement.GetString();
            if (!string.IsNullOrEmpty(text)) yield return text;
        }
    }

    public ValueTask DisposeAsync()
    {
        response.Dispose();
        return ValueTask.CompletedTask;
    }
}

internal sealed class AiProviderRateLimitException(int? retryAfterSeconds) : Exception("AI provider returned HTTP 429.")
{
    internal int? RetryAfterSeconds { get; } = retryAfterSeconds;
}

internal sealed class AiProviderHttpException(int statusCode) : HttpRequestException($"AI provider returned HTTP {statusCode}.")
{
    internal int ProviderStatusCode { get; } = statusCode;
}
