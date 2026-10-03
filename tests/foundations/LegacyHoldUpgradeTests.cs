using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

internal static class LegacyHoldUpgradeTests
{
    private static async Task SchemaCommand(FylkrenDbContext db, string action, string schema, string suffix = "")
    {
        if (!schema.StartsWith("synthetic_hold_upgrade_", StringComparison.Ordinal) || schema.Any(c => !(char.IsAsciiLetterOrDigit(c) || c == '_'))) throw new Exception("Invalid synthetic schema.");
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = action + " " + schema + suffix;
        await command.ExecuteNonQueryAsync();
    }
    internal static async Task Run(FylkrenDbContext source)
    {
        var schema = "synthetic_hold_upgrade_" + Guid.NewGuid().ToString("N");
        // Caller already enforces the disposable foundation database. No production schema is touched.
        var connection = new Npgsql.NpgsqlConnectionStringBuilder(source.Database.GetConnectionString()) { SearchPath = schema };
        await SchemaCommand(source, "CREATE SCHEMA", schema);
        try
        {
            await using var db = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection.ConnectionString).Options);
            var migrations = db.GetService<IMigrationsAssembly>().Migrations.Keys;
            await db.GetService<IMigrator>().MigrateAsync(migrations.Single(m => m.EndsWith("_LifecycleGovernanceGuards")));
            var at = DateTimeOffset.UtcNow.AddYears(-1);
            var site = new Site(Guid.NewGuid(), "Synthetic legacy hold upgrade", at); db.Sites.Add(site);
            var root = new InformationLifecycleRecord(Guid.NewGuid(), site.Id, "site", site.Id, null, at);
            root.SetHold(true, root.Version, "Historical hold, original actor unavailable", at); db.InformationLifecycles.Add(root); await db.SaveChangesAsync();
            var before = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.Database.MigrateAsync();
            var hold = await db.LifecycleHolds.SingleAsync(h => h.LifecycleId == root.Id);
            if (hold.Source != "legacy" || hold.CreatedByPersonId is not null || hold.CreatedAt < before || hold.Reason != root.Reason || hold.ReleasedAt is not null)
                throw new Exception("Legacy hold reconciliation fabricated attribution or discarded preservation.");
            Console.WriteLine("Legacy hold upgrade passed: populated pre-preservation schema retains hold with explicit unknown actor and migration-time provenance.");
        }
        finally { await SchemaCommand(source, "DROP SCHEMA", schema, " CASCADE"); }
    }
}
