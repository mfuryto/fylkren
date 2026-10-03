using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Identity;
using Fylkren.Api.Portability;
using Fylkren.Api.Organization;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class LifecycleGovernanceModelConfiguration
{
    internal static void ConfigureLifecycleGovernance(this ModelBuilder m)
    {
        var grant = m.Entity<ArchiveGrant>(); grant.ToTable("archive_grants"); grant.HasKey(g => g.Id);
        grant.HasIndex(g => new { g.SiteId, g.PersonId }).IsUnique().HasFilter("is_active");
        grant.HasOne<Site>().WithMany().HasForeignKey(g => g.SiteId).OnDelete(DeleteBehavior.Restrict);
        grant.HasOne<Person>().WithMany().HasForeignKey(g => g.PersonId).OnDelete(DeleteBehavior.Restrict);
        grant.Property(g => g.Version).IsConcurrencyToken();
        var hold = m.Entity<LifecycleHold>(); hold.ToTable("lifecycle_holds", table => table.HasCheckConstraint("CK_lifecycle_hold_source", "(source = 'local' AND created_by_person_id IS NOT NULL) OR (source = 'legacy' AND created_by_person_id IS NULL)")); hold.HasKey(h => h.Id);
        hold.Property(h => h.Source).HasMaxLength(30).HasDefaultValue("local");
        hold.Property(h => h.Reason).HasMaxLength(1000); hold.Property(h => h.ReleaseReason).HasMaxLength(1000);
        hold.HasIndex(h => new { h.LifecycleId, h.ReleasedAt });
        hold.HasOne<InformationLifecycleRecord>().WithMany().HasForeignKey(h => h.LifecycleId).OnDelete(DeleteBehavior.Restrict);
        hold.HasOne<Person>().WithMany().HasForeignKey(h => h.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);
        hold.HasOne<Person>().WithMany().HasForeignKey(h => h.ReleasedByPersonId).OnDelete(DeleteBehavior.Restrict);
        var policy = m.Entity<RetentionPolicyVersion>(); policy.ToTable("retention_policy_versions"); policy.HasKey(p => new { p.PolicyId, p.Version });
        policy.Property(p => p.Name).HasMaxLength(200); policy.Property(p => p.Category).HasMaxLength(30);
        policy.HasOne<Person>().WithMany().HasForeignKey(p => p.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<InformationLifecycleRecord>().HasOne<RetentionPolicyVersion>().WithMany().HasForeignKey(l => new { l.PolicyId, l.PolicyVersion }).OnDelete(DeleteBehavior.Restrict);
        var receipt = m.Entity<ExportReceipt>(); receipt.ToTable("export_receipts"); receipt.HasKey(r => r.Id);
        receipt.Property(r => r.Version).IsConcurrencyToken(); receipt.Property(r => r.SnapshotBoundary).HasMaxLength(1000);
        receipt.Property(r => r.PackageSha256).HasMaxLength(64); receipt.Property(r => r.AcknowledgementReason).HasMaxLength(1000);
        receipt.HasIndex(r => new { r.SiteId, r.CreatedAt });
        receipt.HasOne<Site>().WithMany().HasForeignKey(r => r.SiteId).OnDelete(DeleteBehavior.Restrict);
        receipt.HasOne<Person>().WithMany().HasForeignKey(r => r.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);
        receipt.HasOne<Person>().WithMany().HasForeignKey(r => r.AcknowledgedByPersonId).OnDelete(DeleteBehavior.Restrict);
        foreach (var entity in new[] { grant.Metadata, hold.Metadata, policy.Metadata, receipt.Metadata })
            foreach (var property in entity.GetProperties()) property.SetColumnName(System.Text.Json.JsonNamingPolicy.SnakeCaseLower.ConvertName(property.Name));
    }
}
