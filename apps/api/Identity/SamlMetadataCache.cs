using System.Xml;
using Fylkren.Api.Networking;
using Fylkren.Api.Platform;
using Microsoft.Extensions.Options;
using Sustainsys.Saml2;
using Sustainsys.Saml2.AspNetCore2;
using Sustainsys.Saml2.Configuration;
using Sustainsys.Saml2.Metadata;

namespace Fylkren.Api.Identity;

// One configured IdP, refreshed on demand before expiry. Never delegate remote
// downloads to the library's unbounded WebClient or keep expired metadata active.
internal sealed class SamlMetadataCache(IHttpClientFactory clients, IOptionsMonitorCache<Saml2Options> options,
    OutboundHttpPolicy destinations, TimeProvider? clock = null) : IDisposable
{
    private readonly TimeProvider time = clock ?? TimeProvider.System;
    private Snapshot? current;
    private readonly SemaphoreSlim gate = new(1, 1);
    private sealed record Snapshot(string Url, string EntityId, EntityDescriptor Metadata, DateTime ExpiresAt);
    internal EntityDescriptor Prepared(SamlOptions configuration)
    {
        var value = Volatile.Read(ref current);
        if (value is null || value.Url != configuration.MetadataUrl || value.EntityId != configuration.IdentityProviderEntityId || value.ExpiresAt <= time.GetUtcNow().UtcDateTime)
            throw new HttpRequestException("SAML metadata is unavailable or expired.");
        return value.Metadata;
    }
    internal async Task Prepare(SamlOptions configuration, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            var url = configuration.MetadataUrl!; var entityId = configuration.IdentityProviderEntityId!;
            var value = current;
            if (value is not null && value.Url == url && value.EntityId == entityId && value.ExpiresAt > time.GetUtcNow().UtcDateTime) return;
            Volatile.Write(ref current, null);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(10));
            using var client = clients.CreateClient("identity-provider-test");
            using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            response.EnsureSuccessStatusCode();
            await response.Content.LoadIntoBufferAsync(2_000_000, timeout.Token);
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var xml = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 2_000_000 });
            if (new MetadataSerializer().ReadMetadata(xml) is not EntityDescriptor metadata || metadata.EntityId.Id != entityId)
                throw new HttpRequestException("Unexpected SAML metadata identity.");
            var idp = new IdentityProvider(new EntityId(entityId), new SPOptions());
            idp.ReadMetadata(metadata);
            if (idp.SingleSignOnServiceUrl is null)
                throw new HttpRequestException("SAML metadata has no supported sign-in destination.");
            var signingKeys = idp.SigningKeys.ToArray();
            if (signingKeys.Length == 0 || signingKeys.Any(key => !ExternalKeyStrength.MeetsMinimum(key)))
                throw new HttpRequestException("SAML metadata contains an unsupported or insufficient signing key.");
            destinations.ValidateIdentityDestination(idp.SingleSignOnServiceUrl, configuration.MetadataUrl);
            var expiry = idp.MetadataValidUntil ?? time.GetUtcNow().UtcDateTime.AddMinutes(15);
            if (expiry <= time.GetUtcNow().UtcDateTime) throw new HttpRequestException("SAML metadata has expired.");
            // Refresh before certificate/metadata expiry, with a bounded default cache.
            var refresh = time.GetUtcNow().UtcDateTime.AddMinutes(15);
            if (expiry < refresh) refresh = expiry;
            Volatile.Write(ref current, new(url, entityId, metadata, refresh));
            options.TryRemove(Saml2Defaults.Scheme);
        }
        finally { gate.Release(); }
    }
    public void Dispose() => gate.Dispose();
}

internal sealed class SamlMetadataMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, FylkrenOptions options, SamlMetadataCache metadata)
    {
        var saml = options.Authentication.Saml;
        if (saml.Enabled && (context.Request.Path == "/api/auth/saml/login" || context.Request.Path.StartsWithSegments(saml.ModulePath)))
        {
            if (context.Request.Query.ContainsKey("SAMLart")) throw new HttpRequestException("SAML artifact binding is not supported.");
            await metadata.Prepare(saml, context.RequestAborted);
        }
        await next(context);
    }
}
