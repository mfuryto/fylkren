using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Xml.Linq;
using Fylkren.Api.Platform;
using Microsoft.Extensions.DependencyInjection;

public static class DataProtectionKeyCustodyTests
{
    public static void Run()
    {
        using var rsa = RSA.Create(3072);
        var request = new CertificateRequest("CN=Fylkren custody test", rsa, HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1),
            DateTimeOffset.UtcNow.AddDays(1));
        var source = XElement.Parse("<masterKey requiresEncryption=\"true\"><value>synthetic-secret</value></masterKey>");
        var encrypted = new DataProtectionKeyEncryptor(certificate).Encrypt(source);
        Require(!encrypted.EncryptedElement.ToString().Contains("synthetic-secret", StringComparison.Ordinal),
            "Custody envelope exposed plaintext.");
        Require((string?)encrypted.EncryptedElement.Attribute("algorithm") == "rsa-oaep-sha256+a256gcm",
            "Custody envelope lost its fixed algorithm identifier.");
        using var services = new ServiceCollection().AddSingleton(certificate).BuildServiceProvider();
        var decrypted = new DataProtectionKeyDecryptor(services).Decrypt(encrypted.EncryptedElement);
        Require(XNode.DeepEquals(source, decrypted), "Custody envelope did not round-trip.");

        var tampered = new XElement(encrypted.EncryptedElement);
        tampered.Elements().Single(value => value.Name.LocalName == "tag").Value = Convert.ToBase64String(new byte[16]);
        Reject(() => new DataProtectionKeyDecryptor(services).Decrypt(tampered),
            "Modified custody envelope was accepted.");

        var directory = Path.Combine(Path.GetTempPath(), $"fylkren-custody-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        try
        {
            var path = Path.Combine(directory, "key-synthetic.xml");
            new XDocument(new XElement("key", new XElement("descriptor",
                new XElement("masterKey", new XAttribute("requiresEncryption", "true"),
                    new XElement("value", "migration-secret"))))).Save(path);
            Require(DataProtectionKeyCustodyMigration.ProtectDirectory(directory, certificate) == 1,
                "Plaintext key was not migrated.");
            var migrated = File.ReadAllText(path);
            Require(!migrated.Contains("migration-secret", StringComparison.Ordinal) &&
                    !migrated.Contains("<masterKey", StringComparison.Ordinal) &&
                    migrated.Contains(typeof(DataProtectionKeyDecryptor).FullName!, StringComparison.Ordinal),
                "Migrated key retained plaintext or lost its decryptor binding.");
            Require(DataProtectionKeyCustodyMigration.ProtectDirectory(directory, certificate) == 0,
                "Custody migration was not idempotent.");
            var document = XDocument.Load(path);
            var envelope = document.Descendants().Single(value => value.Name.LocalName == "fylkrenEncryptedKey");
            Require(new DataProtectionKeyDecryptor(services).Decrypt(envelope).Descendants("value").Single().Value ==
                    "migration-secret", "Migrated key could not be recovered with matching custody.");
        }
        finally
        {
            Directory.Delete(directory, true);
        }
        Console.WriteLine("Data Protection key custody tests passed.");
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }

    private static void Reject(Action action, string message)
    {
        try { action(); }
        catch (CryptographicException) { return; }
        throw new Exception(message);
    }
}
