using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.XmlEncryption;
using Microsoft.Extensions.DependencyInjection;

namespace Fylkren.Api.Platform;

public sealed class DataProtectionKeyEncryptor(X509Certificate2 certificate) : IXmlEncryptor
{
    internal const string Algorithm = "rsa-oaep-sha256+a256gcm";
    private static readonly XNamespace Namespace = "urn:fylkren:data-protection-key-custody:v1";

    public EncryptedXmlInfo Encrypt(XElement plaintextElement)
    {
        using var rsa = certificate.GetRSAPublicKey() ??
            throw new CryptographicException("The Data Protection custody certificate has no RSA public key.");
        var plaintext = Encoding.UTF8.GetBytes(plaintextElement.ToString(SaveOptions.DisableFormatting));
        var contentKey = RandomNumberGenerator.GetBytes(32);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];
        var thumbprint = certificate.GetCertHashString(HashAlgorithmName.SHA256).ToLowerInvariant();
        var associatedData = Encoding.UTF8.GetBytes($"{Algorithm}\n{thumbprint}");
        try
        {
            using var aes = new AesGcm(contentKey, tag.Length);
            aes.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);
            var wrappedKey = rsa.Encrypt(contentKey, RSAEncryptionPadding.OaepSHA256);
            var encrypted = new XElement(Namespace + "fylkrenEncryptedKey",
                new XAttribute("version", "1"),
                new XAttribute("algorithm", Algorithm),
                new XAttribute("certificateSha256", thumbprint),
                new XElement(Namespace + "wrappedKey", Convert.ToBase64String(wrappedKey)),
                new XElement(Namespace + "nonce", Convert.ToBase64String(nonce)),
                new XElement(Namespace + "tag", Convert.ToBase64String(tag)),
                new XElement(Namespace + "ciphertext", Convert.ToBase64String(ciphertext)));
            return new EncryptedXmlInfo(encrypted, typeof(DataProtectionKeyDecryptor));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(contentKey);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }
}

public sealed class DataProtectionKeyDecryptor(IServiceProvider services) : IXmlDecryptor
{
    private readonly X509Certificate2 _certificate = services.GetRequiredService<X509Certificate2>();
    private static readonly XNamespace Namespace = "urn:fylkren:data-protection-key-custody:v1";

    public XElement Decrypt(XElement encryptedElement)
    {
        try
        {
            if (encryptedElement.Name != Namespace + "fylkrenEncryptedKey" ||
                (string?)encryptedElement.Attribute("version") != "1" ||
                (string?)encryptedElement.Attribute("algorithm") != DataProtectionKeyEncryptor.Algorithm)
                throw new CryptographicException("Unsupported Data Protection custody envelope.");
            var expectedThumbprint = _certificate.GetCertHashString(HashAlgorithmName.SHA256).ToLowerInvariant();
            var actualThumbprint = (string?)encryptedElement.Attribute("certificateSha256") ?? "";
            if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expectedThumbprint),
                    Encoding.ASCII.GetBytes(actualThumbprint)))
                throw new CryptographicException("The Data Protection custody certificate does not match the envelope.");
            var wrappedKey = Read(encryptedElement, "wrappedKey", 1024);
            var nonce = Read(encryptedElement, "nonce", 12);
            var tag = Read(encryptedElement, "tag", 16);
            var ciphertext = Read(encryptedElement, "ciphertext", 16_384);
            using var rsa = _certificate.GetRSAPrivateKey() ??
                throw new CryptographicException("The Data Protection custody certificate has no RSA private key.");
            var contentKey = rsa.Decrypt(wrappedKey, RSAEncryptionPadding.OaepSHA256);
            if (contentKey.Length != 32) throw new CryptographicException("Invalid Data Protection custody content key.");
            var plaintext = new byte[ciphertext.Length];
            var associatedData = Encoding.UTF8.GetBytes($"{DataProtectionKeyEncryptor.Algorithm}\n{expectedThumbprint}");
            try
            {
                using var aes = new AesGcm(contentKey, tag.Length);
                aes.Decrypt(nonce, ciphertext, tag, plaintext, associatedData);
                return XElement.Parse(Encoding.UTF8.GetString(plaintext), LoadOptions.PreserveWhitespace);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(contentKey);
                CryptographicOperations.ZeroMemory(plaintext);
            }
        }
        catch (Exception exception) when (exception is FormatException or InvalidOperationException)
        {
            throw new CryptographicException("Invalid Data Protection custody envelope.", exception);
        }
    }

    private static byte[] Read(XElement envelope, string name, int maximumBytes)
    {
        var values = envelope.Elements(Namespace + name).ToArray();
        if (values.Length != 1 || values[0].Value.Length > maximumBytes * 2)
            throw new CryptographicException("Invalid Data Protection custody envelope field.");
        var decoded = Convert.FromBase64String(values[0].Value);
        if (decoded.Length == 0 || decoded.Length > maximumBytes ||
            name == "nonce" && decoded.Length != 12 || name == "tag" && decoded.Length != 16)
            throw new CryptographicException("Invalid Data Protection custody envelope field length.");
        return decoded;
    }
}

public static class DataProtectionKeyCustodyMigration
{
    public static int ProtectDirectory(string directory, X509Certificate2 certificate)
    {
        directory = Path.GetFullPath(directory);
        if (!Directory.Exists(directory)) throw new DirectoryNotFoundException(directory);
        var encryptor = new DataProtectionKeyEncryptor(certificate);
        var files = Directory.GetFiles(directory, "*.xml", SearchOption.TopDirectoryOnly);
        var protectedCount = 0;
        foreach (var file in files)
        {
            var document = XDocument.Load(file, LoadOptions.PreserveWhitespace);
            var encrypted = document.Descendants().Where(value => value.Name.LocalName == "encryptedSecret").ToArray();
            var plaintext = document.Descendants().Where(value => value.Name.LocalName == "masterKey" &&
                value.Attributes().Any(attribute => attribute.Name.LocalName == "requiresEncryption" && attribute.Value == "true")).ToArray();
            if (encrypted.Length == 1 && plaintext.Length == 0)
            {
                var decryptor = (string?)encrypted[0].Attribute("decryptorType") ?? "";
                if (!decryptor.StartsWith(typeof(DataProtectionKeyDecryptor).FullName + ",", StringComparison.Ordinal))
                    throw new InvalidOperationException($"Unsupported existing Data Protection key custody: {Path.GetFileName(file)}");
                continue;
            }
            if (encrypted.Length != 0 || plaintext.Length != 1)
                throw new InvalidOperationException($"Unexpected Data Protection key structure: {Path.GetFileName(file)}");
            var protectedValue = encryptor.Encrypt(new XElement(plaintext[0]));
            XNamespace dataProtection = "http://schemas.asp.net/2015/03/dataProtection";
            plaintext[0].ReplaceWith(new XElement(dataProtection + "encryptedSecret",
                new XAttribute("decryptorType", protectedValue.DecryptorType.AssemblyQualifiedName ??
                    throw new InvalidOperationException("Decryptor type has no assembly identity.")),
                protectedValue.EncryptedElement));
            var temporary = file + ".protecting";
            try
            {
                using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                    document.Save(output, SaveOptions.DisableFormatting);
                if (!OperatingSystem.IsWindows())
                    File.SetUnixFileMode(temporary, UnixFileMode.UserRead | UnixFileMode.UserWrite);
                File.Move(temporary, file, true);
                protectedCount++;
            }
            finally
            {
                if (File.Exists(temporary)) File.Delete(temporary);
            }
        }
        if (files.Any(file => File.ReadAllText(file).Contains("<masterKey", StringComparison.Ordinal)))
            throw new InvalidOperationException("Every Data Protection key file must be custody-protected.");
        return protectedCount;
    }
}
