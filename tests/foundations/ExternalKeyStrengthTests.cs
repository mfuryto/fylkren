using System.Formats.Cbor;
using System.Security.Cryptography;
using Fylkren.Api.Identity;
using Microsoft.IdentityModel.Tokens;

internal static class ExternalKeyStrengthTests
{
    internal static void Run()
    {
        using var weakRsa = RSA.Create(2048);
        using var strongRsa = RSA.Create(3072);
        Require(!ExternalKeyStrength.MeetsMinimum(new RsaSecurityKey(weakRsa)), "OIDC accepted RSA-2048.");
        Require(ExternalKeyStrength.MeetsMinimum(new RsaSecurityKey(strongRsa)), "OIDC rejected RSA-3072.");

        Require(!ExternalKeyStrength.MeetsWebAuthnMinimum(RsaCoseKey(weakRsa)), "WebAuthn accepted RSA-2048.");
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(RsaCoseKey(strongRsa)), "WebAuthn rejected RSA-3072.");
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(1, -8, 6)), "WebAuthn rejected Ed25519.");
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(1, -8, 7)), "WebAuthn rejected Ed448.");
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(2, -7, 1)), "WebAuthn rejected P-256.");
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(2, -35, 2)), "WebAuthn rejected P-384.");
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(2, -36, 3)), "WebAuthn rejected P-521.");
        Require(!ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(1, -8, 4)), "WebAuthn accepted X25519 as a signing key.");
        Require(!ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(2, -7, 2)), "WebAuthn accepted a mismatched EC algorithm and curve.");
        Require(!ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(4, -8, 6)), "WebAuthn accepted an unsupported COSE key type.");
        Require(!ExternalKeyStrength.MeetsWebAuthnMinimum([0xff]), "Malformed WebAuthn key passed the strength boundary.");
        Console.WriteLine("External key-strength tests passed: OIDC and WebAuthn reject RSA-2048, accept RSA-3072, and retain approved non-RSA WebAuthn keys.");
    }

    private static byte[] RsaCoseKey(RSA rsa)
    {
        var parameters = rsa.ExportParameters(false);
        var writer = new CborWriter(CborConformanceMode.Strict);
        writer.WriteStartMap(4);
        writer.WriteInt32(1); writer.WriteInt32(3);
        writer.WriteInt32(3); writer.WriteInt32(-257);
        writer.WriteInt32(-1); writer.WriteByteString(parameters.Modulus!);
        writer.WriteInt32(-2); writer.WriteByteString(parameters.Exponent!);
        writer.WriteEndMap();
        return writer.Encode();
    }

    private static byte[] NonRsaCoseKey(int keyType, int algorithm, int curve)
    {
        var writer = new CborWriter(CborConformanceMode.Strict);
        writer.WriteStartMap(3);
        writer.WriteInt32(1); writer.WriteInt32(keyType);
        writer.WriteInt32(3); writer.WriteInt32(algorithm);
        writer.WriteInt32(-1); writer.WriteInt32(curve);
        writer.WriteEndMap();
        return writer.Encode();
    }

    private static void Require(bool value, string message)
    {
        if (!value) throw new Exception(message);
    }
}
