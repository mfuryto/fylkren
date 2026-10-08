using System.Net.Http.Headers;
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
        using var request = new HttpRequestMessage(HttpMethod.Post, settings.EndpointUrl);
        var key = Unprotect(settings.ProtectedApiKey);
        if (key is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            model = settings.Model, temperature = 0.2, max_tokens = 1400,
            messages = new[] { new { role = "system", content = systemPrompt }, new { role = "user", content = userPrompt } }
        }), Encoding.UTF8, "application/json");
        using var response = await clients.CreateClient("ai-provider").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode) throw new HttpRequestException($"AI provider returned HTTP {(int)response.StatusCode}.");
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var content = json.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(content)) throw new HttpRequestException("AI provider returned an empty response.");
        return content.Length <= 20_000 ? content : content[..20_000];
    }
}
