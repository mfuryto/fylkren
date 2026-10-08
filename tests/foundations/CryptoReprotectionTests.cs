using Fylkren.Api.DomainEvents;
using Fylkren.Api.Federation;
using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.ArtificialIntelligence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

internal static class CryptoReprotectionTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var actor = new Person(Guid.NewGuid(), "Synthetic cryptographic custodian", now);
        var identity = new LoginIdentity(Guid.NewGuid(), actor.Id, "synthetic-crypto-custodian", true, now);
        identity.SetPasswordHash("synthetic-password-verifier");
        var protection = new EphemeralDataProtectionProvider();
        string Protect(string plaintext, string purpose) => protection.CreateProtector(purpose).Protect(plaintext);
        string Open(string ciphertext, string purpose) => protection.CreateProtector(purpose).Unprotect(ciphertext);

        identity.EnableTotp(Protect("synthetic-totp", ProtectedValuePurposes.TotpSecret), ["synthetic-recovery-hash"]);
        var smtp = new SmtpSettings(Guid.NewGuid());
        smtp.Update(true, "mail.synthetic.test", 587, "starttls", "synthetic-user",
            Protect("synthetic-smtp", ProtectedValuePurposes.SmtpPassword), "sender@example.invalid", "Synthetic");
        var provider = new IdentityProviderSettings("oidc", false,
            Protect("{\"Authority\":\"https://idp.example.invalid\"}", ProtectedValuePurposes.IdentityProviderConfiguration), now);
        var webhook = new WebhookSubscription(Guid.NewGuid(), Guid.NewGuid(), "Synthetic webhook",
            "https://example.invalid/hook", Protect("synthetic-webhook", ProtectedValuePurposes.WebhookSecret),
            "task.created", actor.Id, now);
        var ai = await db.AiSettings.SingleOrDefaultAsync(value => value.Id == DatabaseDefaults.AiSettingsId) ?? new AiSettings(DatabaseDefaults.AiSettingsId);
        if (db.Entry(ai).State == EntityState.Detached) db.AiSettings.Add(ai);
        ai.Update(true, "https://ai.example.invalid/v1/chat/completions", "synthetic-model",
            Protect("synthetic-ai-key", ProtectedValuePurposes.AiProviderApiKey), true, true, true, true);
        var federation = new FederationSigningIdentity("synthetic-public-key",
            Protect("synthetic-active-private-key", ProtectedValuePurposes.FederationSigningKey), now);
        federation.StageRotation(Guid.NewGuid(), "synthetic-pending-public-key",
            Protect("synthetic-pending-private-key", ProtectedValuePurposes.FederationSigningKey), now);
        db.People.Add(actor); db.LoginIdentities.Add(identity); db.SmtpSettings.Add(smtp);
        db.IdentityProviderSettings.Add(provider); db.WebhookSubscriptions.Add(webhook);
        db.FederationSigningIdentities.Add(federation);
        await db.SaveChangesAsync();

        var before = new[] { identity.TotpSecret!, smtp.ProtectedPassword!, provider.ProtectedConfiguration,
            webhook.ProtectedSecret, ai.ProtectedApiKey!, federation.ProtectedPrivateKey, federation.PendingProtectedPrivateKey! };
        var service = new CryptoReprotectionService(protection);
        var operation = await service.Create(actor.Id, "backup-2026-10-06T20:30Z",
            "Restore the matching database and Data Protection key-ring snapshot.", db, default)
            ?? throw new Exception("Protected-value operation was not created.");
        Require(operation.TotalItems == 7 && operation.Status == "pending",
            "Protected-value inventory did not include every configured slot.");
        var firstBatch = await service.Continue(operation.Id, actor.Id, 2, db, default);
        Require(firstBatch?.CompletedItems == 2 && firstBatch.Status == "pending",
            "Bounded re-protection batch did not retain resumable progress.");
        Require(await service.Create(actor.Id, "other-backup", "other-rollback", db, default) is null,
            "A second operation started while protected-value migration was incomplete.");
        while (operation.Status != "completed")
            operation = (await service.Continue(operation.Id, actor.Id, 2, db, default))!;
        Require(operation.CompletedItems == 7, "Re-protection operation did not complete its inventory.");

        db.ChangeTracker.Clear();
        identity = await db.LoginIdentities.SingleAsync(value => value.Id == identity.Id);
        smtp = await db.SmtpSettings.SingleAsync(value => value.Id == smtp.Id);
        provider = await db.IdentityProviderSettings.SingleAsync(value => value.Provider == provider.Provider);
        webhook = await db.WebhookSubscriptions.SingleAsync(value => value.Id == webhook.Id);
        ai = await db.AiSettings.SingleAsync(value => value.Id == DatabaseDefaults.AiSettingsId);
        federation = await db.FederationSigningIdentities.SingleAsync(value => value.Key == 1);
        var after = new[] { identity.TotpSecret!, smtp.ProtectedPassword!, provider.ProtectedConfiguration,
            webhook.ProtectedSecret, ai.ProtectedApiKey!, federation.ProtectedPrivateKey, federation.PendingProtectedPrivateKey! };
        Require(before.Zip(after).All(pair => pair.First != pair.Second),
            "At least one inventoried ciphertext was not replaced.");
        Require(Open(identity.TotpSecret!, ProtectedValuePurposes.TotpSecret) == "synthetic-totp" &&
            Open(smtp.ProtectedPassword!, ProtectedValuePurposes.SmtpPassword) == "synthetic-smtp" &&
            Open(webhook.ProtectedSecret, ProtectedValuePurposes.WebhookSecret) == "synthetic-webhook" &&
            Open(ai.ProtectedApiKey!, ProtectedValuePurposes.AiProviderApiKey) == "synthetic-ai-key" &&
            Open(federation.ProtectedPrivateKey, ProtectedValuePurposes.FederationSigningKey) == "synthetic-active-private-key" &&
            Open(federation.PendingProtectedPrivateKey!, ProtectedValuePurposes.FederationSigningKey) == "synthetic-pending-private-key",
            "Re-protection changed protected plaintext.");

        var unavailable = new WebhookSubscription(Guid.NewGuid(), Guid.NewGuid(), "Unavailable key fixture",
            "https://example.invalid/unavailable", "not-data-protection-ciphertext", "task.created", actor.Id, now);
        db.WebhookSubscriptions.Add(unavailable); await db.SaveChangesAsync();
        var interrupted = await service.Create(actor.Id, "backup-before-interruption", "Restore matching keys", db, default)
            ?? throw new Exception("A follow-up operation did not start after completion.");
        interrupted = await service.Continue(interrupted.Id, actor.Id, CryptoReprotectionService.MaximumBatchSize, db, default)
            ?? throw new Exception("Interrupted operation disappeared.");
        Require(interrupted.Status == "failed" && interrupted.CompletedItems == 0 &&
            interrupted.FailureCode == "protected_value_unavailable",
            "Unavailable Data Protection material did not stop and preserve the batch.");
        db.WebhookSubscriptions.Remove(await db.WebhookSubscriptions.SingleAsync(value => value.Id == unavailable.Id));
        await db.SaveChangesAsync();
        interrupted = await service.Continue(interrupted.Id, actor.Id, CryptoReprotectionService.MaximumBatchSize, db, default)
            ?? throw new Exception("Recovering operation disappeared.");
        Require(interrupted.Status == "completed" && interrupted.CompletedItems == interrupted.TotalItems,
            "Interrupted re-protection could not resume after key recovery.");
        var auditTypes = await db.AuditEvents.AsNoTracking().Where(value => value.EntityId == interrupted.Id)
            .Select(value => value.EventType).ToListAsync();
        Require(auditTypes.Contains("crypto-reprotection.created") &&
            auditTypes.Contains("crypto-reprotection.failed") && auditTypes.Contains("crypto-reprotection.completed"),
            "Re-protection lifecycle was not recorded in the security audit.");
        Console.WriteLine("Protected-value re-protection tests passed: complete inventory, bounded resume, plaintext preservation, single-operation guard, unavailable-key rollback/recovery and audit lifecycle.");
    }
}
