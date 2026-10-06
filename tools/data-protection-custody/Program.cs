using System.Security.Cryptography.X509Certificates;
using Fylkren.Api.Platform;

if (args.Length != 3)
    throw new ArgumentException("Usage: Fylkren.DataProtectionCustody KEY_DIRECTORY CERTIFICATE_PEM PRIVATE_KEY_PEM");
using var certificate = X509Certificate2.CreateFromPemFile(args[1], args[2]);
var protectedCount = DataProtectionKeyCustodyMigration.ProtectDirectory(args[0], certificate);
Console.WriteLine($"Data Protection custody verified; migrated {protectedCount} plaintext key file(s).");
