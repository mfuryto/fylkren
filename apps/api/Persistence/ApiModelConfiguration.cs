using Fylkren.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class ApiModelConfiguration
{
    internal static void ConfigureApi(this ModelBuilder modelBuilder)
    {
        var apiMachine = modelBuilder.Entity<ApiMachineIdentity>();
        apiMachine.ToTable("api_machine_identities", table => table.HasCheckConstraint(
            "ck_api_machine_secret_parameters",
            "secret_iterations BETWEEN 100000 AND 1000000 AND ((secret_algorithm = 'pbkdf2-sha256' AND secret_hash_version = 1) OR (secret_algorithm = 'pbkdf2-sha512' AND secret_hash_version = 2))"));
        apiMachine.HasKey(x => x.Id);
        apiMachine.Property(x => x.Id).HasColumnName("id");
        apiMachine.Property(x => x.Name).HasColumnName("name").HasMaxLength(120);
        apiMachine.Property(x => x.KeyId).HasColumnName("key_id").HasMaxLength(16);
        apiMachine.Property(x => x.Salt).HasColumnName("salt");
        apiMachine.Property(x => x.SecretHash).HasColumnName("secret_hash");
        apiMachine.Property(x => x.SecretAlgorithm).HasColumnName("secret_algorithm").HasMaxLength(40);
        apiMachine.Property(x => x.SecretHashVersion).HasColumnName("secret_hash_version");
        apiMachine.Property(x => x.SecretIterations).HasColumnName("secret_iterations");
        apiMachine.Property(x => x.Scopes).HasColumnName("scopes").HasMaxLength(300);
        apiMachine.Property(x => x.ExpiresAt).HasColumnName("expires_at");
        apiMachine.Property(x => x.CreatedAt).HasColumnName("created_at");
        apiMachine.Property(x => x.LastUsedAt).HasColumnName("last_used_at");
        apiMachine.Property(x => x.IsActive).HasColumnName("is_active");
        apiMachine.HasIndex(x => x.KeyId).IsUnique();

        var apiAudit = modelBuilder.Entity<ApiMachineAuditEvent>();
        apiAudit.ToTable("api_machine_audit_events");
        apiAudit.HasKey(x => x.Id);
        apiAudit.Property(x => x.DomainEventId).HasColumnName("domain_event_id");
        apiAudit.Property(x => x.Id).HasColumnName("id");
        apiAudit.Property(x => x.MachineIdentityId).HasColumnName("machine_identity_id");
        apiAudit.Property(x => x.SiteId).HasColumnName("site_id");
        apiAudit.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(100);
        apiAudit.Property(x => x.EntityType).HasColumnName("entity_type").HasMaxLength(100);
        apiAudit.Property(x => x.EntityId).HasColumnName("entity_id");
        apiAudit.Property(x => x.CorrelationId).HasColumnName("correlation_id").HasMaxLength(100);
        apiAudit.Property(x => x.OccurredAt).HasColumnName("occurred_at");
        apiAudit.HasOne(x => x.MachineIdentity).WithMany().HasForeignKey(x => x.MachineIdentityId).OnDelete(DeleteBehavior.Restrict);
        apiAudit.HasOne(x => x.Site).WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        apiAudit.HasIndex(x => x.OccurredAt);
        apiAudit.HasIndex(x => x.SiteId);

        var apiIdempotency = modelBuilder.Entity<ApiIdempotencyRecord>();
        apiIdempotency.ToTable("api_idempotency_records");
        apiIdempotency.HasKey(x => x.Id);
        apiIdempotency.Property(x => x.Id).HasColumnName("id");
        apiIdempotency.Property(x => x.MachineIdentityId).HasColumnName("machine_identity_id");
        apiIdempotency.Property(x => x.Key).HasColumnName("key").HasMaxLength(128);
        apiIdempotency.Property(x => x.RequestHash).HasColumnName("request_hash").HasMaxLength(64);
        apiIdempotency.Property(x => x.ResourceId).HasColumnName("resource_id");
        apiIdempotency.Property(x => x.CreatedAt).HasColumnName("created_at");
        apiIdempotency.HasOne(x => x.MachineIdentity).WithMany().HasForeignKey(x => x.MachineIdentityId).OnDelete(DeleteBehavior.Restrict);
        apiIdempotency.HasIndex(x => new { x.MachineIdentityId, x.Key }).IsUnique();

        var reportGrant = modelBuilder.Entity<ApiReportGrant>();
        reportGrant.ToTable("api_report_grants");
        reportGrant.HasKey(x => x.Id);
        reportGrant.Property(x => x.Id).HasColumnName("id");
        reportGrant.Property(x => x.MachineIdentityId).HasColumnName("machine_identity_id");
        reportGrant.Property(x => x.SiteId).HasColumnName("site_id");
        reportGrant.Property(x => x.OrganizationUnitId).HasColumnName("organization_unit_id");
        reportGrant.Property(x => x.IncludeClassified).HasColumnName("include_classified");
        reportGrant.Property(x => x.CreatedAt).HasColumnName("created_at");
        reportGrant.HasOne(x => x.MachineIdentity).WithMany().HasForeignKey(x => x.MachineIdentityId).OnDelete(DeleteBehavior.Restrict);
        reportGrant.HasIndex(x => new { x.MachineIdentityId, x.SiteId, x.OrganizationUnitId }).IsUnique();

        var cryptoOperation = modelBuilder.Entity<CryptoReprotectionOperation>();
        cryptoOperation.ToTable("crypto_reprotection_operations", table =>
        {
            table.HasCheckConstraint("ck_crypto_reprotection_status", "status IN ('pending','completed','failed')");
            table.HasCheckConstraint("ck_crypto_reprotection_progress", "total_items >= 0 AND completed_items >= 0 AND completed_items <= total_items");
        });
        cryptoOperation.HasKey(x => x.Id);
        cryptoOperation.Property(x => x.Id).HasColumnName("id");
        cryptoOperation.Property(x => x.CreatedByPersonId).HasColumnName("created_by_person_id");
        cryptoOperation.Property(x => x.BackupReference).HasColumnName("backup_reference").HasMaxLength(200);
        cryptoOperation.Property(x => x.RollbackReference).HasColumnName("rollback_reference").HasMaxLength(500);
        cryptoOperation.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
        cryptoOperation.Property(x => x.TotalItems).HasColumnName("total_items");
        cryptoOperation.Property(x => x.CompletedItems).HasColumnName("completed_items");
        cryptoOperation.Property(x => x.CreatedAt).HasColumnName("created_at");
        cryptoOperation.Property(x => x.StartedAt).HasColumnName("started_at");
        cryptoOperation.Property(x => x.CompletedAt).HasColumnName("completed_at");
        cryptoOperation.Property(x => x.FailedAt).HasColumnName("failed_at");
        cryptoOperation.Property(x => x.FailureCode).HasColumnName("failure_code").HasMaxLength(100);
        cryptoOperation.HasIndex(x => new { x.Status, x.CreatedAt });

        var cryptoItem = modelBuilder.Entity<CryptoReprotectionItem>();
        cryptoItem.ToTable("crypto_reprotection_items");
        cryptoItem.HasKey(x => x.Id);
        cryptoItem.Property(x => x.Id).HasColumnName("id");
        cryptoItem.Property(x => x.OperationId).HasColumnName("operation_id");
        cryptoItem.Property(x => x.Store).HasColumnName("store").HasMaxLength(40);
        cryptoItem.Property(x => x.RecordKey).HasColumnName("record_key").HasMaxLength(100);
        cryptoItem.Property(x => x.Slot).HasColumnName("slot").HasMaxLength(40);
        cryptoItem.Property(x => x.CompletedAt).HasColumnName("completed_at");
        cryptoItem.HasOne(x => x.Operation).WithMany().HasForeignKey(x => x.OperationId).OnDelete(DeleteBehavior.Cascade);
        cryptoItem.HasIndex(x => new { x.OperationId, x.CompletedAt, x.Id });
        cryptoItem.HasIndex(x => new { x.OperationId, x.Store, x.RecordKey, x.Slot }).IsUnique();
    }
}
