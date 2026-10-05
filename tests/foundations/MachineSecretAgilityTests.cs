using Fylkren.Api.Platform;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

internal static class MachineSecretAgilityTests
{
    internal static void Run()
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }

        const string legacySecret = "synthetic-legacy-machine-secret";
        var legacySalt = Enumerable.Range(1, 16).Select(value => (byte)value).ToArray();
        var legacyHash = ApiMachineSecrets.Hash(legacySecret, legacySalt,
            ApiMachineSecrets.LegacyAlgorithm, ApiMachineSecrets.LegacyIterations);
        var legacy = new ApiMachineIdentity(Guid.NewGuid(), "Legacy", "legacy0000000001", legacySalt,
            legacyHash, "sites:read", DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow);

        Require(ApiMachineSecrets.Verify(legacySecret, legacy), "Legacy machine verifier was not accepted.");
        Require(!ApiMachineSecrets.Verify("wrong-secret", legacy), "Incorrect machine secret was accepted.");
        Require(ApiMachineSecrets.NeedsUpgrade(legacy), "Legacy machine verifier was not marked for upgrade.");
        ApiMachineSecrets.Upgrade(legacySecret, legacy);
        Require(legacy.SecretAlgorithm == ApiMachineSecrets.CurrentAlgorithm &&
            legacy.SecretHashVersion == ApiMachineSecrets.CurrentVersion &&
            legacy.SecretIterations == ApiMachineSecrets.CurrentIterations,
            "Machine verifier metadata was not upgraded.");
        Require(ApiMachineSecrets.Verify(legacySecret, legacy), "Upgraded machine verifier rejected its secret.");
        Require(!ApiMachineSecrets.NeedsUpgrade(legacy), "Current machine verifier still requests upgrade.");

        var generated = ApiMachineSecrets.Create();
        var separator = generated.Token.IndexOf('.');
        var generatedSecret = generated.Token[(separator + 1)..];
        var current = new ApiMachineIdentity(Guid.NewGuid(), "Current", generated.KeyId, generated.Salt,
            generated.Hash, generated.Algorithm, generated.Version, generated.Iterations, "sites:read",
            DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow);
        Require(ApiMachineSecrets.Verify(generatedSecret, current), "New machine verifier rejected its generated secret.");
        Require(!ApiMachineSecrets.NeedsUpgrade(current), "New machine verifier was created with stale parameters.");

        var unsupported = new ApiMachineIdentity(Guid.NewGuid(), "Unsupported", "unknown000000001",
            generated.Salt, generated.Hash, "unknown", 99, 220_000, "sites:read",
            DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow);
        Require(!ApiMachineSecrets.Verify(generatedSecret, unsupported), "Unknown verifier algorithm was accepted.");

        Console.WriteLine("Machine-secret agility tests passed: versioned new writes, legacy verification, opportunistic upgrade, incorrect-secret rejection and unknown-algorithm fail-closed behavior.");
    }

    internal static async Task RunDatabase(FylkrenDbContext db)
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        var migrator = db.GetService<IMigrator>();
        var migrations = db.GetService<IMigrationsAssembly>().Migrations.Keys.ToArray();
        var agility = migrations.Single(value => value.EndsWith("_VersionMachineSecretVerifiers"));
        var previous = migrations.TakeWhile(value => value != agility).Last();
        await migrator.MigrateAsync(previous);

        var id = Guid.NewGuid();
        var created = DateTimeOffset.UtcNow;
        const string secret = "synthetic-populated-upgrade-secret";
        var salt = Enumerable.Range(1, 16).Select(value => (byte)value).ToArray();
        var hash = ApiMachineSecrets.Hash(secret, salt, ApiMachineSecrets.LegacyAlgorithm,
            ApiMachineSecrets.LegacyIterations);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO api_machine_identities(id,name,key_id,salt,secret_hash,scopes,expires_at,created_at,is_active) VALUES({id},'Populated legacy','legacyupgrade001',{salt},{hash},'sites:read',{created.AddDays(1)},{created},true)");

        await migrator.MigrateAsync(agility);
        db.ChangeTracker.Clear();
        var upgradedSchema = await db.ApiMachineIdentities.SingleAsync(value => value.Id == id);
        Require(upgradedSchema.SecretAlgorithm == ApiMachineSecrets.LegacyAlgorithm &&
            upgradedSchema.SecretHashVersion == ApiMachineSecrets.LegacyVersion &&
            upgradedSchema.SecretIterations == ApiMachineSecrets.LegacyIterations,
            "Populated migration did not label the existing verifier with its actual parameters.");
        Require(ApiMachineSecrets.Verify(secret, upgradedSchema), "Populated migration invalidated the existing machine credential.");
        ApiMachineSecrets.Upgrade(secret, upgradedSchema);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var persisted = await db.ApiMachineIdentities.SingleAsync(value => value.Id == id);
        Require(persisted.SecretHashVersion == ApiMachineSecrets.CurrentVersion &&
            ApiMachineSecrets.Verify(secret, persisted), "Upgraded verifier metadata or hash did not persist.");

        try
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE api_machine_identities SET secret_iterations=1 WHERE id={id}");
            throw new Exception("Unsafe machine verifier parameters passed the database constraint.");
        }
        catch (Npgsql.PostgresException error) when (error.SqlState == "23514") { }

        await migrator.MigrateAsync(previous);
        await migrator.MigrateAsync(agility);
        Console.WriteLine("Machine-secret database agility tests passed: populated upgrade, parameter constraint, persistence and reversible schema migration.");
    }
}
