using Fylkren.Api.DomainEvents;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Persistence;
using Fylkren.Api.Organization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

if (args.Contains("--input-validation-only"))
{
    InputValidationTests.Run();
    return;
}
if (args.Contains("--zip-length-only"))
{
    await ZipLengthBoundaryTests.Run();
    return;
}
if (args.Contains("--image-validation-only"))
{
    ImageValidationTests.Run();
    return;
}
if (args.Contains("--version-boundaries-only"))
{
    VersionBoundaryTests.Run();
    return;
}
if (args.Contains("--arithmetic-only"))
{
    NumericArithmeticTests.Run();
    return;
}
if (args.Contains("--service-transports-only"))
{
    await ServiceTransportTests.Run();
    return;
}
if (args.Contains("--outbound-http-only"))
{
    await OutboundHttpTests.Run();
    await SamlMetadataTests.Run();
    return;
}
if (args.Contains("--external-key-strength-only"))
{
    ExternalKeyStrengthTests.Run();
    await SamlMetadataTests.Run();
    return;
}
var now = DateTimeOffset.UtcNow;
var site = Guid.NewGuid(); var origin = Guid.NewGuid(); var actor = Guid.NewGuid(); var resource = Guid.NewGuid();
var operation = Guid.NewGuid();
var context = new DomainEventContext("local", "person", origin, site, operation, ActorPersonId: actor);
DomainEvent Fact(DomainEventContext? ctx = null, string metadata = "{}") => DomainEvent.Create(Guid.NewGuid(), "assignment.updated", site,
    "work_item", resource, null, ctx ?? context, metadata, now, now, "updated");
void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
void Reject(Action action) { try { action(); } catch (Exception error) when (error is ArgumentException or InvalidOperationException) { return; } throw new Exception("Unsafe action was accepted."); }
var fact = Fact(metadata: "{\"status\":\"completed\"}");
Require(fact.Source == "local" && fact.ActorPersonId == actor && fact.OperationId == operation && fact.OriginSiteId == site, "Local event attribution lost.");
Reject(() => Fact(context with { Source = "federated" }));
Reject(() => Fact(context with { ActorSystem = "spoofed" }));
Reject(() => Fact(context with { OriginInstanceId = Guid.Empty }));
Reject(() => Fact(context with { RequestId = "unsafe\nrequest" }));
Reject(() => Fact(metadata: "{\"password\":\"secret\"}"));
Reject(() => Fact(metadata: "{\"status\":{\"nested\":true}}"));
Reject(() => Fact(metadata: "{\"status\":\"a\",\"status\":\"b\"}"));
Reject(() => Fact(metadata: "{\"status\":\"" + new string('x', 4096) + "\"}"));
Require(Fact(context with { ActorKind = "machine", ActorPersonId = null, ActorMachineId = actor }).ActorMachineId == actor, "Machine identity lost.");
Require(Fact(context with { Source = "system", ActorKind = "system", ActorPersonId = null, ActorSystem = "synthetic-worker" }).ActorKind == "system", "System identity lost.");
Require(Fact(context with { Source = "federated", ActorKind = "federated-site", ActorPersonId = null, ActorInstanceId = origin, ActorSiteId = site }).Source == "federated", "Peer identity lost.");
var legacy = new DomainEvent(Guid.NewGuid(), "task.created", 1, now, site, actor, "task", resource, "{\"title\":\"synthetic\"}");
Require(legacy.Source == "legacy" && legacy.RecordedAt is null && legacy.PayloadJson.Contains("synthetic"), "Legacy fact was rewritten.");
var lifecycle = new InformationLifecycleRecord(Guid.NewGuid(), site, "work_item", resource, null, now);
Reject(() => lifecycle.Transition("archived", 1, "Invalid direct archive", now));
lifecycle.Transition("closed", 1, "Synthetic closure", now);
Reject(() => lifecycle.Transition("archived", 1, "Stale revision", now));
lifecycle.SetHold(true, 2, "Synthetic hold", now);
Reject(() => lifecycle.Transition("archived", 3, "Held archive", now));
lifecycle.SetHold(false, 3, "Release synthetic hold", now);
lifecycle.Transition("archived", 4, "Synthetic archive", now);
foreach (var stage in new[] { "deleted", "anonymised", "retention", "active" }) Reject(() => lifecycle.Transition(stage, 5, "Disabled transition", now));
lifecycle.Transition("closed", 5, "Synthetic restore", now);
lifecycle.Transition("active", 6, "Synthetic reopen", now);
Require(lifecycle.Stage == "active" && lifecycle.Version == 7 && lifecycle.PolicyId is null && lifecycle.EligibleAt is null, "A retention policy was invented.");
var projection = new EventProjection("webhooks", fact.Id, now);
var lease = Guid.NewGuid(); projection.Claim(lease, now);
Reject(() => projection.Claim(Guid.NewGuid(), now));
Reject(() => projection.Complete(Guid.NewGuid(), now));
projection.Fail(lease, now, "synthetic retry");
Reject(() => projection.Claim(lease, now));
projection.Claim(lease, now.AddMinutes(1)); projection.Complete(lease, now.AddMinutes(1));
Reject(() => projection.Claim(lease, now.AddHours(1)));
var expired = new EventProjection("notifications", fact.Id, now); expired.Claim(lease, now);
Reject(() => expired.Complete(lease, now.AddMinutes(6)));
expired.Claim(Guid.NewGuid(), now.AddMinutes(6));
var connection = Environment.GetEnvironmentVariable("FYLKREN_FOUNDATION_TEST_DATABASE");
if (connection is null) throw new Exception("Run with the disposable database harness; integration coverage is mandatory.");
if (!connection.Contains("Database=fylkren_foundation_test", StringComparison.Ordinal)) throw new Exception("Only the synthetic foundation database is allowed.");
await using var db = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection).Options);
if (args.Contains("--version-integration-only"))
{
    VersionBoundaryTests.Run();
    await VersionDatabaseBoundaryTests.Run(db);
    await DomainCoverageTests.Run(db);
    await GovernanceTests.Run(db);
    await PreservationTests.Run(db);
    await AutomaticLifecycleTests.Run(db);
    return;
}
if (args.Contains("--arithmetic-integration-only"))
{
    NumericArithmeticTests.Run();
    await db.Database.MigrateAsync();
    await AutomaticLifecycleTests.Run(db);
    await NavigationCountTests.Run(db, false);
    return;
}
if (args.Contains("--navigation-counts-only"))
{
    await NavigationCountTests.Run(db, args.Contains("--measure"));
    return;
}
if (args.Contains("--execution-activity-only"))
{
    await ExecutionActivityTests.Run(db);
    return;
}
var migrations = db.GetService<IMigrationsAssembly>().Migrations.Keys.ToArray();
var foundation = migrations.Single(x => x.EndsWith("_AddActivityLifecycleFoundation"));
var previous = migrations.TakeWhile(x => x != foundation).Last();
var migrator = db.GetService<IMigrator>();
await migrator.MigrateAsync(previous);
await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO domain_events(id,event_type,schema_version,occurred_at,site_id,actor_person_id,resource_type,resource_id,payload_json) VALUES({legacy.Id},'task.created',1,{now},{site},{actor},'task',{resource},'{{\"title\":\"synthetic\"}}'::jsonb)");
await migrator.MigrateAsync(foundation);
var upgraded = await db.DomainEvents.AsNoTracking().SingleAsync(x => x.Id == legacy.Id);
Require(upgraded.Source == "legacy" && upgraded.ActorPersonId == actor && upgraded.PayloadJson.Contains("synthetic") && upgraded.RecordedAt is null, "Populated upgrade changed legacy history.");
Require(await db.EventProjections.CountAsync() == 0, "Upgrade scheduled historical deliveries.");
await db.Database.MigrateAsync();
db.Sites.Add(new Site(site, "Synthetic foundation site", now)); await db.SaveChangesAsync();
db.DomainEvents.Add(fact); db.EventProjections.Add(new EventProjection("webhooks", fact.Id, now)); db.InformationLifecycles.Add(lifecycle); await db.SaveChangesAsync();
await using (var transaction = await db.Database.BeginTransactionAsync())
{
    var rollback = Fact(context with { OperationId = Guid.NewGuid() }); db.DomainEvents.Add(rollback); await db.SaveChangesAsync(); await transaction.RollbackAsync();
    Require(!await db.DomainEvents.AsNoTracking().AnyAsync(x => x.Id == rollback.Id), "Rolled-back fact persisted.");
}
db.ChangeTracker.Clear();
var immutable = await db.DomainEvents.SingleAsync(x => x.Id == fact.Id); db.Entry(immutable).Property(x => x.PayloadJson).CurrentValue = "{\"changed\":true}";
Reject(() => db.SaveChanges()); db.ChangeTracker.Clear();
var frozen = await db.DomainEvents.SingleAsync(x => x.Id == fact.Id); frozen.MarkWebhooksProjected(now); await db.SaveChangesAsync();
await using (var other = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection).Options))
{
    var claimant = await db.EventProjections.SingleAsync(x => x.Consumer == "webhooks" && x.DomainEventId == fact.Id);
    var losingClaim = await other.EventProjections.SingleAsync(x => x.Consumer == "webhooks" && x.DomainEventId == fact.Id);
    claimant.Claim(Guid.NewGuid(), now); await db.SaveChangesAsync(); losingClaim.Claim(Guid.NewGuid(), now);
    try { await other.SaveChangesAsync(); throw new Exception("Two workers acquired one projection lease."); } catch (DbUpdateConcurrencyException) { }
    other.ChangeTracker.Clear();
    var first = await db.InformationLifecycles.SingleAsync(x => x.Id == lifecycle.Id); var stale = await other.InformationLifecycles.SingleAsync(x => x.Id == lifecycle.Id);
    first.Transition("closed", 7, "First writer", now); await db.SaveChangesAsync(); stale.Transition("closed", 7, "Stale writer", now);
    try { await other.SaveChangesAsync(); throw new Exception("Lifecycle race overwrote history."); } catch (DbUpdateConcurrencyException) { }
}
try
{
    await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE domain_events SET source='local',actor_kind='system' WHERE id={fact.Id}");
    throw new Exception("Invalid actor database constraint accepted.");
}
catch (Npgsql.PostgresException error) when (error.SqlState == "23514") { }
await migrator.MigrateAsync(previous);
await migrator.MigrateAsync(foundation);
Require((await db.DomainEvents.AsNoTracking().SingleAsync(x => x.Id == legacy.Id)).PayloadJson.Contains("synthetic"), "Reversible schema migration lost original events.");
Console.WriteLine("Foundation tests passed: actor/schema/metadata boundaries, lifecycle/hold/version guards, projection lease/retry, populated migration without dispatch, rollback, immutable facts, concurrency, SQL constraints and reversible pre-cutover upgrade.");
await WorkSliceTests.Run(db);

await DomainCoverageTests.Run(db);
await OutboundHttpTests.Run();
await SamlMetadataTests.Run();
ExternalKeyStrengthTests.Run();
await ServiceTransportTests.Run();
NumericArithmeticTests.Run();
VersionBoundaryTests.Run();
await ZipLengthBoundaryTests.Run();
await NavigationCountTests.Run(db, false);
await ExecutionActivityTests.Run(db);

await GovernanceTests.Run(db);

await PreservationTests.Run(db);

await LegacyHoldUpgradeTests.Run(db);

await ConsumerReconciliationTests.Run(db);

await AutomaticLifecycleTests.Run(db);
