using System.Security.Cryptography;
using System.Text.Json;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

internal static class LicenseAgilityTests
{
    internal static void Run()
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        using var issuer = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var service = new LicenseService(Convert.ToBase64String(issuer.ExportSubjectPublicKeyInfo()));
        var instance = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        (string Payload, string Signature) Issue(int schema, string? algorithm)
        {
            var payload = JsonSerializer.SerializeToUtf8Bytes(new
            {
                schemaVersion = schema, licenseId = Guid.NewGuid(), instanceId = instance,
                customer = "Synthetic", notBefore = now.AddMinutes(-1), expiresAt = now.AddDays(1),
                entitlements = new[] { "machine-api" }, signatureAlgorithm = algorithm
            });
            var signature = issuer.SignData(payload, HashAlgorithmName.SHA256,
                DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
            return (Convert.ToBase64String(payload), Convert.ToBase64String(signature));
        }

        var legacy = Issue(1, null);
        Require(service.Evaluate(legacy.Payload, legacy.Signature, instance, now).State == "valid",
            "Legacy schema-1 licence was not accepted.");
        var current = Issue(2, LicenseService.CurrentSignatureAlgorithm);
        Require(service.Evaluate(current.Payload, current.Signature, instance, now,
            LicenseService.CurrentSignatureAlgorithm).State == "valid", "Versioned licence was not accepted.");
        Require(service.Evaluate(current.Payload, current.Signature, instance, now).State == "invalid",
            "Versioned licence accepted a removed envelope algorithm.");
        Require(service.Evaluate(current.Payload, current.Signature, instance, now, "unknown").State == "invalid",
            "Versioned licence accepted an unknown envelope algorithm.");
        var unknown = Issue(2, "unknown");
        Require(service.Evaluate(unknown.Payload, unknown.Signature, instance, now, "unknown").State == "invalid",
            "Signed licence payload accepted an unknown algorithm.");
        Console.WriteLine("Licence-signature agility tests passed: legacy read, versioned current format, signed algorithm binding and downgrade/unknown-algorithm rejection.");
    }

    internal static async Task RunDatabase(FylkrenDbContext db)
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        var migrator = db.GetService<IMigrator>();
        var migrations = db.GetService<IMigrationsAssembly>().Migrations.Keys.ToArray();
        var agility = migrations.Single(value => value.EndsWith("_VersionLicenseSignatures"));
        var previous = migrations.TakeWhile(value => value != agility).Last();
        await migrator.MigrateAsync(previous);

        var actor = Guid.NewGuid();
        var importedAt = DateTimeOffset.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO installed_license(key,payload,signature,imported_by,imported_at) VALUES(1,'synthetic-legacy-payload','synthetic-legacy-signature',{actor},{importedAt})");

        await migrator.MigrateAsync(agility);
        db.ChangeTracker.Clear();
        var upgraded = await db.InstalledLicenses.AsNoTracking().SingleAsync(value => value.Key == 1);
        Require(upgraded.Payload == "synthetic-legacy-payload" &&
            upgraded.Signature == "synthetic-legacy-signature" &&
            upgraded.ImportedBy == actor &&
            (upgraded.ImportedAt - importedAt).Duration() < TimeSpan.FromMilliseconds(1) &&
            upgraded.SignatureAlgorithm is null,
            "Populated migration changed the installed legacy licence.");

        await migrator.MigrateAsync(previous);
        await migrator.MigrateAsync(agility);
        db.ChangeTracker.Clear();
        Require((await db.InstalledLicenses.AsNoTracking().SingleAsync()).SignatureAlgorithm is null,
            "Reversible schema migration changed the legacy algorithm marker.");
        Console.WriteLine("Licence-signature database agility tests passed: populated legacy preservation and reversible schema migration.");
    }
}
