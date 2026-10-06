using Fylkren.Api.Federation;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

internal static class FederationAgilityTests
{
    internal static void Run()
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        var peer = new FederationPeer(Guid.NewGuid(), "Synthetic peer", "https://peer.example", DateTimeOffset.UtcNow);
        Require(peer.NegotiatedProtocolVersion == 1 && peer.SignatureAlgorithm is null,
            "New peer did not start in the legacy-compatible protocol.");
        peer.RecordProtocol(2, FederationSignatureProtocol.CurrentAlgorithm);
        Require(peer.NegotiatedProtocolVersion == 2 &&
            peer.SignatureAlgorithm == FederationSignatureProtocol.CurrentAlgorithm,
            "Peer did not persist the current signed protocol.");
        peer.RecordProtocol(1, null);
        Require(peer.NegotiatedProtocolVersion == 2,
            "A legacy offer downgraded a peer after versioned negotiation.");
        try
        {
            peer.RecordProtocol(2, "unknown");
            throw new Exception("Unknown federation signature algorithm was accepted.");
        }
        catch (InvalidOperationException) { }
        peer.Update("Synthetic peer", "https://replacement.example");
        Require(peer.NegotiatedProtocolVersion == 2 &&
            peer.SignatureAlgorithm == FederationSignatureProtocol.CurrentAlgorithm,
            "A peer metadata change silently downgraded the protocol.");
        Console.WriteLine("Federation-signature agility tests passed: legacy start, v2 persistence, downgrade resistance, unknown-algorithm rejection and metadata-change preservation.");
    }

    internal static async Task RunDatabase(FylkrenDbContext db)
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        var migrator = db.GetService<IMigrator>();
        var migrations = db.GetService<IMigrationsAssembly>().Migrations.Keys.ToArray();
        var agility = migrations.Single(value => value.EndsWith("_VersionFederationSignatures"));
        var previous = migrations.TakeWhile(value => value != agility).Last();
        await migrator.MigrateAsync(previous);
        var id = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO federation_peers(instance_id,name,base_url,created_at,is_active) VALUES({id},'Populated legacy peer','https://legacy.example',{now},true)");
        await migrator.MigrateAsync(agility);
        db.ChangeTracker.Clear();
        var peer = await db.FederationPeers.SingleAsync(value => value.InstanceId == id);
        Require(peer.NegotiatedProtocolVersion == 1 && peer.SignatureAlgorithm is null,
            "Populated peer did not retain the legacy protocol marker.");
        peer.RecordProtocol(2, FederationSignatureProtocol.CurrentAlgorithm);
        await db.SaveChangesAsync();
        try
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE federation_peers SET negotiated_protocol_version=1 WHERE instance_id={id}");
            throw new Exception("Inconsistent federation protocol metadata passed the database constraint.");
        }
        catch (Npgsql.PostgresException error) when (error.SqlState == "23514") { }
        await migrator.MigrateAsync(previous);
        await migrator.MigrateAsync(agility);
        db.ChangeTracker.Clear();
        var restored = await db.FederationPeers.AsNoTracking().SingleAsync(value => value.InstanceId == id);
        Require(restored.NegotiatedProtocolVersion == 1 && restored.SignatureAlgorithm is null,
            "Rollback did not return the peer to a safe legacy-compatible state.");
        Console.WriteLine("Federation-signature database agility tests passed: populated upgrade, protocol constraint and safe down/up rollback.");
    }
}
