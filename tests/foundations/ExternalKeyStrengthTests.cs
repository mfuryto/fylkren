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
        Require(ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey()), "WebAuthn rejected an approved non-RSA key type.");
        Require(!ExternalKeyStrength.MeetsWebAuthnMinimum(NonRsaCoseKey(4)), "WebAuthn accepted an unsupported COSE key type.");
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

    private static byte[] NonRsaCoseKey(int keyType = 2)
    {
        var writer = new CborWriter(CborConformanceMode.Strict);
        writer.WriteStartMap(1);
        writer.WriteInt32(1); writer.WriteInt32(keyType);
        writer.WriteEndMap();
        return writer.Encode();
    }

    private static void Require(bool value, string message)
    {
        if (!value) throw new Exception(message);
    }
}
