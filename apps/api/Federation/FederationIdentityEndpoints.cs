using System.Security.Claims;
using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Fylkren.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationIdentityEndpoints
{
    internal static void MapFederationIdentityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/federation/identity")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapGet("", async (IDataProtectionProvider protection, FylkrenDbContext db,
            CancellationToken ct) =>
        {
            var instanceId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
                .Select(row => row.InstanceId).SingleAsync(ct);
            var identity = await db.FederationSigningIdentities.AsNoTracking()
                .SingleOrDefaultAsync(row => row.Key == 1, ct);
            if (identity is null) return Results.Ok(new { instanceId, keyConfigured = false });
            FederationPublicKey.TryParse(identity.PublicKeySpki, out _, out var fingerprint);
            var keyUsable = KeyUsable(identity, protection);
            return Results.Ok(new { instanceId, keyConfigured = true, keyUsable, identity.PublicKeySpki,
                fingerprint, identity.CreatedAt,
                keyRotationPending = identity.PendingRotationId is not null || identity.ActiveRotationId is not null,
                identity.PendingRotationId, identity.PendingCreatedAt, identity.ActiveRotationId,
                identity.RotationActivatedAt });
        });

        group.MapPost("", async (ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            if (await db.FederationSigningIdentities.AnyAsync(row => row.Key == 1, ct))
                return Results.Conflict(new { error = "federation_identity_exists" });
            using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var publicKey = key.ExportSubjectPublicKeyInfo();
            var privateKey = key.ExportPkcs8PrivateKey();
            string protectedPrivateKey;
            try
            {
                protectedPrivateKey = protection.CreateProtector(ProtectedValuePurposes.FederationSigningKey)
                    .Protect(Convert.ToBase64String(privateKey));
            }
            finally { CryptographicOperations.ZeroMemory(privateKey); }
            var encodedPublicKey = Convert.ToBase64String(publicKey);
            var fingerprint = Convert.ToHexString(SHA256.HashData(publicKey)).ToLowerInvariant();
            var now = DateTimeOffset.UtcNow;
            db.FederationSigningIdentities.Add(new FederationSigningIdentity(encodedPublicKey, protectedPrivateKey, now));
            var audit = new AuditEvent(Guid.NewGuid(), null, actor, "federation-identity.created", "federation-identity",
                await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1).Select(row => row.InstanceId).SingleAsync(ct), now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { instanceId = audit.EntityId, publicKeySpki = encodedPublicKey, fingerprint, createdAt = now });
        }).RequireFeature(FeatureCatalog.InstanceFederation);

        group.MapPost("/rotation", async (ClaimsPrincipal user, IAntiforgery antiforgery,
            HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db,
            CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            var identity = await db.FederationSigningIdentities.SingleOrDefaultAsync(row => row.Key == 1, ct);
            if (identity is null) return Results.Conflict(new { error = "federation_identity_missing" });
            if (!KeyUsable(identity, protection))
                return Results.Conflict(new { error = "federation_key_unusable_recovery_required" });
            if (identity.PendingRotationId is not null || identity.ActiveRotationId is not null)
                return Results.Conflict(new { error = "federation_key_rotation_pending" });
            using var pendingKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var pendingPublic = Convert.ToBase64String(pendingKey.ExportSubjectPublicKeyInfo());
            var pendingPrivate = pendingKey.ExportPkcs8PrivateKey();
            string protectedPendingPrivate;
            try
            {
                protectedPendingPrivate = protection.CreateProtector(ProtectedValuePurposes.FederationSigningKey)
                    .Protect(Convert.ToBase64String(pendingPrivate));
            }
            finally { CryptographicOperations.ZeroMemory(pendingPrivate); }
            var now = DateTimeOffset.UtcNow;
            var rotationId = Guid.NewGuid();
            identity.StageRotation(rotationId, pendingPublic, protectedPendingPrivate, now);
            var instanceId = await LocalInstanceId(db, ct);
            AddAudit(db, actor, instanceId, "federation-identity.key-rotation-created", now);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict(new { error = "federation_key_rotation_pending" });
            }
            return Results.Accepted(value: new { instanceId, rotationId,
                status = "distributing", automatic = true });
        }).RequireFeature(FeatureCatalog.InstanceFederation);

        group.MapPost("/recover", async (ClaimsPrincipal user, IAntiforgery antiforgery,
            HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db,
            CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            var identity = await db.FederationSigningIdentities.SingleOrDefaultAsync(row => row.Key == 1, ct);
            if (identity is null) return Results.Conflict(new { error = "federation_identity_missing" });
            if (KeyUsable(identity, protection))
                return Results.Conflict(new { error = "federation_key_still_usable_use_rotation" });

            using var replacement = ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var publicKey = replacement.ExportSubjectPublicKeyInfo();
            var encodedPublicKey = Convert.ToBase64String(publicKey);
            var privateKey = replacement.ExportPkcs8PrivateKey();
            string protectedPrivateKey;
            try
            {
                protectedPrivateKey = protection.CreateProtector(ProtectedValuePurposes.FederationSigningKey)
                    .Protect(Convert.ToBase64String(privateKey));
            }
            finally { CryptographicOperations.ZeroMemory(privateKey); }
            var now = DateTimeOffset.UtcNow;
            identity.Recover(encodedPublicKey, protectedPrivateKey, now);
            var instanceId = await LocalInstanceId(db, ct);
            AddAudit(db, actor, instanceId, "federation-identity.key-recovered", now);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict(new { error = "federation_key_recovery_conflict" });
            }
            var fingerprint = Convert.ToHexString(SHA256.HashData(publicKey)).ToLowerInvariant();
            return Results.Ok(new { instanceId, publicKeySpki = encodedPublicKey, fingerprint,
                createdAt = now, peersRequireRecoveryApproval = true });
        }).RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static Task<Guid> LocalInstanceId(FylkrenDbContext db, CancellationToken ct) =>
        db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);

    private static void AddAudit(FylkrenDbContext db, Guid actor, Guid instanceId,
        string eventType, DateTimeOffset at)
    {
        var audit = new AuditEvent(Guid.NewGuid(), null, actor, eventType,
            "federation-identity", instanceId, at);
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
    }

    private static bool KeyUsable(FederationSigningIdentity identity,
        IDataProtectionProvider protection)
    {
        try
        {
            using var key = FederationSigningKeys.Load(identity, protection);
            return true;
        }
        catch (CryptographicException) { return false; }
    }
}
