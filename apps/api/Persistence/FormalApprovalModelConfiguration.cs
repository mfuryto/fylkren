using Fylkren.Api.Approvals;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class FormalApprovalModelConfiguration
{
    internal static void ConfigureFormalApprovals(this ModelBuilder modelBuilder)
    {
        var version = modelBuilder.Entity<DomainObjectVersion>();
        version.ToTable("domain_object_versions");
        version.HasKey(x => x.Id);
        version.Property(x => x.Id).HasColumnName("id");
        version.Property(x => x.SiteId).HasColumnName("site_id");
        version.Property(x => x.ObjectType).HasColumnName("object_type").HasMaxLength(60);
        version.Property(x => x.ObjectId).HasColumnName("object_id");
        version.Property(x => x.ContextWorkItemId).HasColumnName("context_work_item_id");
        version.Property(x => x.VersionNumber).HasColumnName("version_number");
        version.Property(x => x.Title).HasColumnName("title").HasMaxLength(240);
        version.Property(x => x.ContentJson).HasColumnName("content_json").HasColumnType("jsonb");
        version.Property(x => x.ContentHash).HasColumnName("content_hash").HasMaxLength(64);
        version.Property(x => x.ApprovalStatus).HasColumnName("approval_status").HasMaxLength(30);
        version.Property(x => x.CreatedByPersonId).HasColumnName("created_by_person_id");
        version.Property(x => x.CreatedAt).HasColumnName("created_at");
        version.HasIndex(x => new { x.SiteId, x.ObjectType, x.ObjectId, x.VersionNumber }).IsUnique();
        version.HasIndex(x => new { x.SiteId, x.ContextWorkItemId, x.CreatedAt });
        version.HasOne<Site>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        version.HasOne<WorkItem>().WithMany().HasForeignKey(x => x.ContextWorkItemId).OnDelete(DeleteBehavior.Restrict);
        version.HasOne(x => x.CreatedByPerson).WithMany().HasForeignKey(x => x.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);

        var signoff = modelBuilder.Entity<FormalApprovalSignoff>();
        signoff.ToTable("formal_approval_signoffs");
        signoff.HasKey(x => x.Id);
        signoff.Property(x => x.Id).HasColumnName("id");
        signoff.Property(x => x.VersionId).HasColumnName("version_id");
        signoff.Property(x => x.ApproverPersonId).HasColumnName("approver_person_id");
        signoff.Property(x => x.ApproverNameSnapshot).HasColumnName("approver_name_snapshot").HasMaxLength(200);
        signoff.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
        signoff.Property(x => x.SignedAt).HasColumnName("signed_at");
        signoff.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(2000);
        signoff.HasIndex(x => new { x.VersionId, x.ApproverPersonId }).IsUnique();
        signoff.HasOne(x => x.Version).WithMany(x => x.Signoffs).HasForeignKey(x => x.VersionId).OnDelete(DeleteBehavior.Restrict);
        signoff.HasOne(x => x.ApproverPerson).WithMany().HasForeignKey(x => x.ApproverPersonId).OnDelete(DeleteBehavior.Restrict);
    }
}
