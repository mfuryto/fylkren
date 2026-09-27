using System.Security.Cryptography;
using System.Text.Json;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Licensing;

internal sealed record LicenseStatus(
    string Edition,
    string State,
    Guid InstanceId,
    Guid? LicenseId,
    string? Customer,
    DateTimeOffset? ExpiresAt,
    IReadOnlySet<string> Entitlements)
{
    internal bool Has(string feature) => FeatureCatalog.IsKnown(feature) && Entitlements.Contains(feature);
}

internal sealed class LicenseService
{
    private readonly IReadOnlyList<byte[]> publicKeys;
    internal bool HasTrustedIssuer => publicKeys.Count > 0;

    internal LicenseService(string? additionalPublicKeySpki)
    {
        var keys = new List<byte[]> { ValidatePublicKey(TrustedIssuerKeys.ProductionSpki) };
        if (!string.IsNullOrWhiteSpace(additionalPublicKeySpki))
        {
            var additional = ValidatePublicKey(additionalPublicKeySpki);
            if (!keys.Any(key => key.AsSpan().SequenceEqual(additional))) keys.Add(additional);
        }
        publicKeys = keys;
    }

    private static byte[] ValidatePublicKey(string publicKeySpki)
    {
        try
        {
            var publicKey = Convert.FromBase64String(publicKeySpki);
            using var verifier = ECDsa.Create();
            verifier.ImportSubjectPublicKeyInfo(publicKey, out var read);
            if (read != publicKey.Length || verifier.KeySize != 256 ||
                verifier.ExportParameters(false).Curve.Oid.Value != "1.2.840.10045.3.1.7")
                throw new CryptographicException("The Enterprise license public key must be P-256 SPKI.");
            return publicKey;
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            throw new InvalidOperationException("Fylkren:License:PublicKeySpki is not a valid P-256 public key.", ex);
        }
    }

    internal async Task<LicenseStatus> Current(FylkrenDbContext db, CancellationToken ct)
    {
        var instanceId = await db.InstanceIdentities.AsNoTracking().Where(x => x.Key == 1).Select(x => x.InstanceId).SingleAsync(ct);
        var installed = await db.InstalledLicenses.AsNoTracking().SingleOrDefaultAsync(x => x.Key == 1, ct);
        return Evaluate(installed?.Payload, installed?.Signature, instanceId, DateTimeOffset.UtcNow);
    }

    internal LicenseStatus Evaluate(string? encodedPayload, string? encodedSignature, Guid instanceId, DateTimeOffset now)
    {
        var community = new LicenseStatus("community", encodedPayload is null ? "none" : "invalid", instanceId, null, null, null, new HashSet<string>());
        if (encodedPayload is null || encodedSignature is null) return community;
        try
        {
            var payload = Convert.FromBase64String(encodedPayload);
            var signature = Convert.FromBase64String(encodedSignature);
            if (payload.Length is < 20 or > 16_384 || signature.Length != 64) return community;
            if (!publicKeys.Any(key => VerifySignature(key, payload, signature)))
                return community;
            var license = JsonSerializer.Deserialize<LicensePayload>(payload, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (license is null || license.SchemaVersion != 1 || license.LicenseId == Guid.Empty || license.InstanceId != instanceId ||
                string.IsNullOrWhiteSpace(license.Customer) || license.Customer.Length > 200 ||
                license.Entitlements is null || license.Entitlements.Length > FeatureCatalog.Enterprise.Count ||
                license.Entitlements.Any(x => !FeatureCatalog.IsKnown(x)) ||
                license.Entitlements.Distinct(StringComparer.Ordinal).Count() != license.Entitlements.Length ||
                license.ExpiresAt <= license.NotBefore)
                return community;
            var details = new LicenseStatus("community", "not-yet-valid", instanceId, license.LicenseId, license.Customer, license.ExpiresAt, new HashSet<string>());
            if (now < license.NotBefore) return details;
            if (now >= license.ExpiresAt) return details with { State = "expired" };
            var entitlements = license.Entitlements.ToHashSet(StringComparer.Ordinal);
            // Federation was added after the first Enterprise licenses were issued.
            // Keep those valid licenses forward-compatible without requiring reissue.
            entitlements.Add(FeatureCatalog.InstanceFederation);
            return details with { Edition = "enterprise", State = "valid", Entitlements = entitlements };
        }
        catch (Exception ex) when (ex is FormatException or JsonException or CryptographicException)
        {
            return community;
        }
    }

    internal async Task<bool> Has(FylkrenDbContext db, string feature, CancellationToken ct) =>
        (await Current(db, ct)).Has(feature);

    private static bool VerifySignature(byte[] publicKey, byte[] payload, byte[] signature)
    {
        using var verifier = ECDsa.Create();
        verifier.ImportSubjectPublicKeyInfo(publicKey, out _);
        return verifier.VerifyData(payload, signature, HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
    }

    private sealed record LicensePayload(int SchemaVersion, Guid LicenseId, Guid InstanceId, string Customer,
        DateTimeOffset NotBefore, DateTimeOffset ExpiresAt, string[] Entitlements);
}
