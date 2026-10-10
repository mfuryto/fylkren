using System.Formats.Cbor;
using System.Numerics;
using System.Security.Cryptography.X509Certificates;

namespace Fylkren.Api.Identity;

internal static class ExternalKeyStrength
{
    internal const int MinimumRsaBits = 3072;

    internal static bool MeetsMinimum(Microsoft.IdentityModel.Tokens.SecurityKey key) =>
        key.KeySize >= MinimumRsaBits;

    internal static bool MeetsMinimum(X509Certificate2 certificate)
    {
        using var rsa = certificate.GetRSAPublicKey();
        return rsa is not null && rsa.KeySize >= MinimumRsaBits;
    }

    internal static bool MeetsMinimum(Sustainsys.Saml2.Tokens.SecurityKeyIdentifierClause key)
    {
        if (key is Sustainsys.Saml2.Tokens.RsaKeyIdentifierClause rsa)
            return rsa.Rsa.KeySize >= MinimumRsaBits;
        if (key is Sustainsys.Saml2.Tokens.X509RawDataKeyIdentifierClause x509)
        {
            using var certificate = X509CertificateLoader.LoadCertificate(x509.GetX509RawData());
            return MeetsMinimum(certificate);
        }
        return false;
    }

    internal static bool MeetsWebAuthnMinimum(ReadOnlySpan<byte> coseKey)
    {
        try
        {
            var reader = new CborReader(coseKey.ToArray(), CborConformanceMode.Strict);
            reader.ReadStartMap();
            int? keyType = null;
            int? algorithm = null;
            int? curve = null;
            byte[]? modulus = null;
            while (reader.PeekState() != CborReaderState.EndMap)
            {
                var label = reader.ReadInt32();
                if (label == 1) keyType = reader.ReadInt32();
                else if (label == 3) algorithm = reader.ReadInt32();
                else if (label == -1 && reader.PeekState() == CborReaderState.ByteString)
                    modulus = reader.ReadByteString();
                else if (label == -1) curve = reader.ReadInt32();
                else reader.SkipValue();
            }
            reader.ReadEndMap();
            if (reader.BytesRemaining != 0 || keyType is null || algorithm is null) return false;
            if (keyType == 1)
                return algorithm == -8 && curve is 6 or 7; // Ed25519 or Ed448.
            if (keyType == 2)
                return (algorithm, curve) is (-7, 1) or (-35, 2) or (-36, 3); // P-256, P-384 or P-521.
            if (keyType != 3) return false;
            if (algorithm is not (-257 or -258 or -259 or -37 or -38 or -39)) return false;
            if (modulus is null) return false;
            var first = Array.FindIndex(modulus, value => value != 0);
            if (first < 0) return false;
            var bits = (modulus.Length - first - 1) * 8 + BitOperations.Log2(modulus[first]) + 1;
            return bits >= MinimumRsaBits;
        }
        catch (Exception error) when (error is CborContentException or InvalidOperationException or OverflowException)
        {
            return false;
        }
    }
}
