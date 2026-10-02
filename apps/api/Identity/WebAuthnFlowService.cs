using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace Fylkren.Api.Identity;

public sealed class WebAuthnFlowService(IDataProtectionProvider provider)
{
    private readonly IDataProtector protector = provider.CreateProtector("Fylkren.WebAuthnFlow.v2");
    public string Protect(Guid grantId, Guid personId, long securityVersion, string optionsJson, string? name, DateTimeOffset expiresAt) =>
        protector.Protect(JsonSerializer.Serialize(new State(grantId, personId, securityVersion, optionsJson, name, expiresAt.ToUnixTimeSeconds())));
    public (Guid GrantId, Guid PersonId, long SecurityVersion, string OptionsJson, string? Name) Read(string token)
    {
        var state = JsonSerializer.Deserialize<State>(protector.Unprotect(token)) ?? throw new CryptographicException();
        if (state.ExpiresAt < DateTimeOffset.UtcNow.ToUnixTimeSeconds()) throw new CryptographicException();
        return (state.GrantId, state.PersonId, state.SecurityVersion, state.OptionsJson, state.Name);
    }
    private sealed record State(Guid GrantId, Guid PersonId, long SecurityVersion, string OptionsJson, string? Name, long ExpiresAt);
}
