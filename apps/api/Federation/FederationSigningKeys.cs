using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Fylkren.Api.Platform;

namespace Fylkren.Api.Federation;

internal static class FederationSigningKeys
{
    internal static ECDsa Load(FederationSigningIdentity identity, IDataProtectionProvider protection)
    {
        var encoded = protection.CreateProtector(ProtectedValuePurposes.FederationSigningKey)
            .Unprotect(identity.ProtectedPrivateKey);
        byte[] der;
        try { der = Convert.FromBase64String(encoded); }
        catch (FormatException ex) { throw new CryptographicException("Invalid protected federation signing key.", ex); }
        try
        {
            var key = ECDsa.Create();
            try
            {
                key.ImportPkcs8PrivateKey(der, out var read);
                if (read != der.Length || key.KeySize != 256 ||
                    Convert.ToBase64String(key.ExportSubjectPublicKeyInfo()) != identity.PublicKeySpki)
                    throw new CryptographicException("Federation signing key does not match its public identity.");
                return key;
            }
            catch
            {
                key.Dispose();
                throw;
            }
        }
        finally { CryptographicOperations.ZeroMemory(der); }
    }
}
