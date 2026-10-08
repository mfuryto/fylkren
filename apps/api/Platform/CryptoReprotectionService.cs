using System.Data;
using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal sealed class CryptoReprotectionService(IDataProtectionProvider protection)
{
    internal const int MaximumBatchSize = 100;

    internal async Task<CryptoReprotectionOperation?> Create(
        Guid actor, string backupReference, string rollbackReference,
        FylkrenDbContext db, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (await db.CryptoReprotectionOperations.AnyAsync(value => value.Status != "completed", ct))
            return null;

        var operationId = Guid.NewGuid();
        var items = await Inventory(operationId, db, ct);
        var now = DateTimeOffset.UtcNow;
        var operation = new CryptoReprotectionOperation(operationId, actor, backupReference,
            rollbackReference, items.Count, now);
        db.CryptoReprotectionOperations.Add(operation);
        db.CryptoReprotectionItems.AddRange(items);
        var audit = new AuditEvent(Guid.NewGuid(), null, actor, "crypto-reprotection.created",
            "crypto-reprotection", operationId, now).WithReason(
            "Protected-value migration started with recorded backup and rollback references.");
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return operation;
    }

    internal async Task<CryptoReprotectionOperation?> Continue(
        Guid operationId, Guid actor, int batchSize, FylkrenDbContext db, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var operation = await db.CryptoReprotectionOperations
            .FromSqlInterpolated($"SELECT * FROM crypto_reprotection_operations WHERE id={operationId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (operation is null) return null;
        if (operation.Status == "completed") return operation;

        var items = await db.CryptoReprotectionItems
            .Where(value => value.OperationId == operationId && value.CompletedAt == null)
            .OrderBy(value => value.Id).Take(Math.Clamp(batchSize, 1, MaximumBatchSize)).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        try
        {
            foreach (var item in items)
            {
                await Reprotect(item, db, ct);
                item.Complete(now);
            }
            operation.RecordBatch(items.Count, now);
            if (operation.Status == "completed")
            {
                var audit = new AuditEvent(Guid.NewGuid(), null, actor, "crypto-reprotection.completed",
                    "crypto-reprotection", operation.Id, now);
                audit.SnapshotActorRole(true);
                db.AuditEvents.Add(audit);
            }
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return operation;
        }
        catch (CryptographicException)
        {
            await transaction.RollbackAsync(ct);
            await transaction.DisposeAsync();
            db.ChangeTracker.Clear();
            var failed = await db.CryptoReprotectionOperations.SingleAsync(value => value.Id == operationId, ct);
            failed.RecordFailure("protected_value_unavailable", now);
            var audit = new AuditEvent(Guid.NewGuid(), null, actor, "crypto-reprotection.failed",
                "crypto-reprotection", operationId, now).WithReason(
                "A protected value could not be opened with the available key ring.");
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            return failed;
        }
    }

    private static async Task<List<CryptoReprotectionItem>> Inventory(
        Guid operationId, FylkrenDbContext db, CancellationToken ct)
    {
        var values = new List<(string Store, string RecordKey, string Slot)>();
        values.AddRange((await db.SmtpSettings.AsNoTracking().Where(value => value.ProtectedPassword != null)
            .Select(value => value.Id).ToListAsync(ct)).Select(id => ("smtp", id.ToString("N"), "password")));
        values.AddRange((await db.IdentityProviderSettings.AsNoTracking().Select(value => value.Provider).ToListAsync(ct))
            .Select(provider => ("identity-provider", provider, "configuration")));
        values.AddRange((await db.LoginIdentities.AsNoTracking().Where(value => value.TotpSecret != null)
            .Select(value => value.Id).ToListAsync(ct)).Select(id => ("totp", id.ToString("N"), "secret")));
        values.AddRange((await db.WebhookSubscriptions.AsNoTracking().Select(value => value.Id).ToListAsync(ct))
            .Select(id => ("webhook", id.ToString("N"), "secret")));
        values.AddRange((await db.AiSettings.AsNoTracking().Where(value => value.ProtectedApiKey != null)
            .Select(value => value.Id).ToListAsync(ct)).Select(id => ("ai-provider", id.ToString("N"), "api-key")));
        values.AddRange((await db.FederationSigningIdentities.AsNoTracking().Select(value => value.Key).ToListAsync(ct))
            .Select(key => ("federation", key.ToString(), "active")));
        values.AddRange((await db.FederationSigningIdentities.AsNoTracking()
            .Where(value => value.PendingProtectedPrivateKey != null).Select(value => value.Key).ToListAsync(ct))
            .Select(key => ("federation", key.ToString(), "pending")));
        return values.OrderBy(value => value.Store, StringComparer.Ordinal)
            .ThenBy(value => value.RecordKey, StringComparer.Ordinal).ThenBy(value => value.Slot, StringComparer.Ordinal)
            .Select(value => new CryptoReprotectionItem(Guid.NewGuid(), operationId,
                value.Store, value.RecordKey, value.Slot)).ToList();
    }

    private async Task Reprotect(CryptoReprotectionItem item, FylkrenDbContext db, CancellationToken ct)
    {
        switch (item.Store, item.Slot)
        {
            case ("smtp", "password"):
            {
                var value = await db.SmtpSettings.SingleOrDefaultAsync(row => row.Id == Guid.ParseExact(item.RecordKey, "N"), ct);
                if (value?.ProtectedPassword is { } ciphertext)
                    value.ReprotectPassword(Reprotect(ciphertext, ProtectedValuePurposes.SmtpPassword));
                break;
            }
            case ("identity-provider", "configuration"):
            {
                var value = await db.IdentityProviderSettings.SingleOrDefaultAsync(row => row.Provider == item.RecordKey, ct);
                if (value is not null)
                    value.ReprotectConfiguration(Reprotect(value.ProtectedConfiguration, ProtectedValuePurposes.IdentityProviderConfiguration));
                break;
            }
            case ("totp", "secret"):
            {
                var value = await db.LoginIdentities.SingleOrDefaultAsync(row => row.Id == Guid.ParseExact(item.RecordKey, "N"), ct);
                if (value?.TotpSecret is { } ciphertext)
                    value.ReprotectTotpSecret(Reprotect(ciphertext, ProtectedValuePurposes.TotpSecret));
                break;
            }
            case ("webhook", "secret"):
            {
                var value = await db.WebhookSubscriptions.SingleOrDefaultAsync(row => row.Id == Guid.ParseExact(item.RecordKey, "N"), ct);
                if (value is not null)
                    value.ReprotectSecret(Reprotect(value.ProtectedSecret, ProtectedValuePurposes.WebhookSecret));
                break;
            }
            case ("ai-provider", "api-key"):
            {
                var value = await db.AiSettings.SingleOrDefaultAsync(row => row.Id == Guid.ParseExact(item.RecordKey, "N"), ct);
                if (value?.ProtectedApiKey is { } ciphertext)
                    value.ReprotectApiKey(Reprotect(ciphertext, ProtectedValuePurposes.AiProviderApiKey));
                break;
            }
            case ("federation", "active"):
            {
                var value = await db.FederationSigningIdentities.SingleOrDefaultAsync(row => row.Key == int.Parse(item.RecordKey), ct);
                if (value is not null)
                    value.ReprotectPrivateKey(Reprotect(value.ProtectedPrivateKey, ProtectedValuePurposes.FederationSigningKey));
                break;
            }
            case ("federation", "pending"):
            {
                var value = await db.FederationSigningIdentities.SingleOrDefaultAsync(row => row.Key == int.Parse(item.RecordKey), ct);
                if (value?.PendingProtectedPrivateKey is { } ciphertext)
                    value.ReprotectPendingPrivateKey(Reprotect(ciphertext, ProtectedValuePurposes.FederationSigningKey));
                break;
            }
            default: throw new InvalidOperationException("The protected-value inventory contains an unsupported slot.");
        }
    }

    private string Reprotect(string ciphertext, string purpose)
    {
        var protector = protection.CreateProtector(purpose);
        var plaintext = protector.Unprotect(ciphertext);
        var replacement = protector.Protect(plaintext);
        if (!string.Equals(protector.Unprotect(replacement), plaintext, StringComparison.Ordinal))
            throw new CryptographicException("Protected-value verification failed.");
        return replacement;
    }
}
