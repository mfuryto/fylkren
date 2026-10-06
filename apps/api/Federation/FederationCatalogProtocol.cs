using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationCatalogRequest(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, long Timestamp, Guid Nonce, string? Signature,
    string? SignatureAlgorithm = null);

internal sealed record FederationCatalogSite(Guid SiteId, string Name, long Revision, bool IsActive);

internal sealed record FederationCatalogResponse(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, long Timestamp, Guid Nonce, FederationCatalogSite[] Sites,
    string Signature, string? SignatureAlgorithm = null);

internal static class FederationCatalogProtocol
{
    internal const int SchemaVersion = 1;

    internal static byte[] RequestBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        string? signatureAlgorithm = null) => Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose("fylkren-federation-catalog-request-v1", signatureAlgorithm),
            sender.ToString("N"), recipient.ToString("N"), timestamp.ToString(CultureInfo.InvariantCulture),
            nonce.ToString("N")
        }.Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));

    internal static byte[] ResponseBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        IReadOnlyCollection<FederationCatalogSite> sites, string? signatureAlgorithm = null)
    {
        var hash = Convert.ToHexString(SHA256.HashData(SiteBytes(sites))).ToLowerInvariant();
        return Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose("fylkren-federation-catalog-response-v1", signatureAlgorithm),
            sender.ToString("N"), recipient.ToString("N"), timestamp.ToString(CultureInfo.InvariantCulture),
            nonce.ToString("N"), hash
        }.Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));
    }

    internal static bool ValidSites(IReadOnlyCollection<FederationCatalogSite>? sites)
    {
        if (sites is null || sites.Count > 2_000) return false;
        var seen = new HashSet<Guid>();
        return sites.All(site => site.SiteId != Guid.Empty && seen.Add(site.SiteId) &&
            site.Revision > 0 && !string.IsNullOrWhiteSpace(site.Name) && site.Name.Length <= 200 &&
            !site.Name.Contains('\0'));
    }

    private static byte[] SiteBytes(IReadOnlyCollection<FederationCatalogSite> sites)
    {
        var builder = new StringBuilder();
        foreach (var site in sites.OrderBy(site => site.SiteId.ToString("N"), StringComparer.Ordinal))
            builder.Append(site.SiteId.ToString("N")).Append('\n')
                .Append(site.Revision.ToString(CultureInfo.InvariantCulture)).Append('\n')
                .Append(site.IsActive ? '1' : '0').Append('\n')
                .Append(Convert.ToBase64String(Encoding.UTF8.GetBytes(site.Name))).Append('\n');
        return Encoding.UTF8.GetBytes(builder.ToString());
    }
}
