using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Notifications;
using Fylkren.Api.Organization;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class WorkItemModelConfiguration
{
    internal static void ConfigureWorkItems(this ModelBuilder modelBuilder)
    {
        var platformReferences = modelBuilder.Entity<PlatformReferenceSettings>();
        platformReferences.ToTable("platform_reference_settings");
        platformReferences.HasKey(value => value.Key);
        platformReferences.Property(value => value.Key).HasColumnName("key").ValueGeneratedNever();
        platformReferences.Property(value => value.MinimumDigits).HasColumnName("minimum_digits").IsRequired();
        platformReferences.Property(value => value.NextNumber).HasColumnName("next_number").IsConcurrencyToken();
        platformReferences.Property(value => value.UpdatedAt).HasColumnName("updated_at").IsRequired();
        platformReferences.Property(value => value.UpdatedBy).HasColumnName("updated_by");

        var siteReferences = modelBuilder.Entity<SiteReferenceSettings>();
        siteReferences.ToTable("site_reference_settings");
        siteReferences.HasKey(value => value.SiteId);
        siteReferences.Property(value => value.SiteId).HasColumnName("site_id").ValueGeneratedNever();
        siteReferences.Property(value => value.Prefix).HasColumnName("prefix").HasMaxLength(12).IsRequired();
        siteReferences.Property(value => value.UpdatedAt).HasColumnName("updated_at").IsRequired();
        siteReferences.Property(value => value.UpdatedBy).HasColumnName("updated_by");
        siteReferences.HasIndex(value => value.Prefix).IsUnique();
        siteReferences.HasOne<Site>().WithOne().HasForeignKey<SiteReferenceSettings>(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);

        var workItem = modelBuilder.Entity<WorkItem>();
        workItem.ToTable("work_items", table => table.HasCheckConstraint("CK_work_items_external_creator",
            "created_by_person_id IS NOT NULL OR created_by_machine_id IS NOT NULL OR NULLIF(BTRIM(sender_site_name), '') IS NOT NULL"));
        workItem.HasKey(value => value.Id);
        workItem.Property(value => value.Id).HasColumnName("id");
        workItem.Property(value => value.SiteId).HasColumnName("site_id");
        workItem.Property(value => value.ReferenceCode).HasColumnName("reference_code").HasMaxLength(80).IsRequired();
        workItem.Property(value => value.ReferenceNumber).HasColumnName("reference_number").IsRequired();
        workItem.Property(value => value.OriginReference).HasColumnName("origin_reference").HasMaxLength(80);
        workItem.Property(value => value.OriginReferenceInstanceId).HasColumnName("origin_reference_instance_id");
        workItem.Property(value => value.ParentWorkItemId).HasColumnName("parent_work_item_id");
        workItem.Property(value => value.WorkItemTypeId).HasColumnName("work_item_type_id");
        workItem.Property(value => value.SourceTypeId).HasColumnName("source_type_id");
        workItem.Property(value => value.SenderId).HasColumnName("sender_id");
        workItem.Property(value => value.SenderSiteName).HasColumnName("sender_site_name").HasMaxLength(200);
        workItem.Property(value => value.SenderPersonName).HasColumnName("sender_person_name").HasMaxLength(200);
        workItem.Property(value => value.SourceTypeNameSnapshot).HasColumnName("source_type_name_snapshot").HasMaxLength(100);
        workItem.Property(value => value.WorkItemTypeNameSnapshot).HasColumnName("work_item_type_name_snapshot").HasMaxLength(100);
        workItem.Property(value => value.SenderNameSnapshot).HasColumnName("sender_name_snapshot").HasMaxLength(100);
        workItem.Property(value => value.UpstreamPlanWorkItemId).HasColumnName("upstream_plan_work_item_id");
        workItem.Property(value => value.RequestBasisSnapshot).HasColumnName("request_basis_snapshot").HasMaxLength(100000);
        workItem.Property(value => value.AssignedUnitId).HasColumnName("assigned_unit_id");
        workItem.Property(value => value.CreatedByPersonId).HasColumnName("created_by_person_id");
        workItem.Property(value => value.CreatedByMachineId).HasColumnName("created_by_machine_id");
        workItem.Property(value => value.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        workItem.Property(value => value.Description).HasColumnName("description").HasMaxLength(10000).IsRequired();
        workItem.Property(value => value.Recommendation).HasColumnName("recommendation").HasMaxLength(4000);
        workItem.Property(value => value.ReferenceUrl).HasColumnName("reference_url").HasMaxLength(2048);
        workItem.Property(value => value.Priority).HasColumnName("priority").HasMaxLength(20).IsRequired();
        workItem.Property(value => value.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        workItem.Property(value => value.DueAt).HasColumnName("due_at");
        workItem.Property(value => value.DecisionNote).HasColumnName("decision_note").HasMaxLength(2000);
        workItem.Property(value => value.FinalReport).HasColumnName("final_report").HasMaxLength(20000);
        workItem.Property(value => value.FinalReportClassification).HasColumnName("final_report_classification").HasMaxLength(20);
        workItem.Property(value => value.FinalReportCreatedAt).HasColumnName("final_report_created_at");
        workItem.Property(value => value.FinalReportUpdatedAt).HasColumnName("final_report_updated_at");
        workItem.Property(value => value.FinalReportWrittenByPersonId).HasColumnName("final_report_written_by_person_id");
        workItem.Property(value => value.FinalReportApprovedByPersonId).HasColumnName("final_report_approved_by_person_id");
        workItem.Property(value => value.FinalReportApprovedAt).HasColumnName("final_report_approved_at");
        workItem.Property(value => value.CreatedAt).HasColumnName("created_at");
        workItem.Property(value => value.UpdatedAt).HasColumnName("updated_at");
        workItem.Property<uint>("xmin").IsRowVersion();
        workItem.HasIndex(value => new { value.SiteId, value.Status, value.DueAt });
        workItem.HasIndex(value => value.ReferenceCode).IsUnique();
        workItem.HasIndex(value => new { value.SiteId, value.ReferenceNumber });
        workItem.HasIndex(value => new { value.SiteId, value.Status, value.CreatedAt });
        workItem.HasIndex(value => new { value.SiteId, value.AssignedUnitId, value.Status, value.FinalReportApprovedAt });
        workItem.HasOne(value => value.Site).WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.ParentWorkItem).WithMany(value => value.ChildWorkItems).HasForeignKey(value => value.ParentWorkItemId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.WorkItemType).WithMany(value => value.WorkItems).HasForeignKey(value => value.WorkItemTypeId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.SourceType).WithMany().HasForeignKey(value => value.SourceTypeId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.Sender).WithMany().HasForeignKey(value => value.SenderId).OnDelete(DeleteBehavior.Restrict);

        var workItemType = modelBuilder.Entity<WorkItemType>();
        workItemType.ToTable("work_item_types");
        workItemType.HasKey(x => x.Id);
        workItemType.Property(x => x.Id).HasColumnName("id");
        workItemType.Property(x => x.SiteId).HasColumnName("site_id");
        workItemType.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        workItemType.Property(x => x.NormalizedName).HasColumnName("normalized_name").HasMaxLength(100);
        workItemType.Property(x => x.Abbreviation).HasColumnName("abbreviation").HasMaxLength(12);
        workItemType.Property(x => x.IsActive).HasColumnName("is_active");
        workItemType.Property(x => x.IsSystemManaged).HasColumnName("is_system_managed");
        workItemType.Property(x => x.CreatedAt).HasColumnName("created_at");
        workItemType.HasIndex(x => new { x.SiteId, x.NormalizedName }).IsUnique();
        workItemType.HasIndex(x => new { x.SiteId, x.Abbreviation }).IsUnique();
        workItemType.HasOne(x => x.Site).WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);

        var lookup = modelBuilder.Entity<WorkItemLookup>();
        lookup.ToTable("work_item_lookups");
        lookup.HasKey(x => x.Id);
        lookup.Property(x => x.Id).HasColumnName("id");
        lookup.Property(x => x.SiteId).HasColumnName("site_id");
        lookup.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(20);
        lookup.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        lookup.Property(x => x.NormalizedName).HasColumnName("normalized_name").HasMaxLength(100);
        lookup.Property(x => x.IsActive).HasColumnName("is_active");
        lookup.Property(x => x.CreatedAt).HasColumnName("created_at");
        lookup.HasIndex(x => new { x.SiteId, x.Kind, x.NormalizedName }).IsUnique();
        lookup.HasOne(x => x.Site).WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.AssignedUnit).WithMany().HasForeignKey(value => value.AssignedUnitId).OnDelete(DeleteBehavior.Restrict);

        var workHistory = modelBuilder.Entity<WorkItemStateHistory>();
        workHistory.ToTable("work_item_state_history");
        workHistory.HasKey(value => value.Id);
        workHistory.Property(value => value.Id).HasColumnName("id");
        workHistory.Property(value => value.WorkItemId).HasColumnName("work_item_id");
        workHistory.Property(value => value.SiteId).HasColumnName("site_id");
        workHistory.Property(value => value.AssignedUnitId).HasColumnName("assigned_unit_id");
        workHistory.Property(value => value.Status).HasColumnName("status").HasMaxLength(30);
        workHistory.Property(value => value.OccurredAt).HasColumnName("occurred_at");
        workHistory.HasIndex(value => new { value.WorkItemId, value.OccurredAt });
        workHistory.HasIndex(value => new { value.SiteId, value.OccurredAt });
        workHistory.HasOne<WorkItem>().WithMany().HasForeignKey(value => value.WorkItemId).OnDelete(DeleteBehavior.Restrict);
        workHistory.HasOne<Site>().WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        workHistory.HasOne<OrganizationUnit>().WithMany().HasForeignKey(value => value.AssignedUnitId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.CreatedByPerson).WithMany().HasForeignKey(value => value.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.CreatedByMachine).WithMany().HasForeignKey(value => value.CreatedByMachineId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.FinalReportWrittenByPerson).WithMany().HasForeignKey(value => value.FinalReportWrittenByPersonId).OnDelete(DeleteBehavior.Restrict);
        workItem.HasOne(value => value.FinalReportApprovedByPerson).WithMany().HasForeignKey(value => value.FinalReportApprovedByPersonId).OnDelete(DeleteBehavior.Restrict);

        var dependency = modelBuilder.Entity<WorkItemDependency>();
        dependency.ToTable("work_item_dependencies", table =>
            table.HasCheckConstraint("CK_work_item_dependencies_distinct_items", "predecessor_work_item_id <> dependent_work_item_id"));
        dependency.HasKey(value => value.Id);
        dependency.Property(value => value.Id).HasColumnName("id");
        dependency.Property(value => value.SiteId).HasColumnName("site_id");
        dependency.Property(value => value.PredecessorWorkItemId).HasColumnName("predecessor_work_item_id");
        dependency.Property(value => value.DependentWorkItemId).HasColumnName("dependent_work_item_id");
        dependency.Property(value => value.Type).HasColumnName("type").HasMaxLength(40).IsRequired();
        dependency.Property(value => value.CreatedByPersonId).HasColumnName("created_by_person_id");
        dependency.Property(value => value.CreatedAt).HasColumnName("created_at");
        dependency.HasIndex(value => new { value.DependentWorkItemId, value.PredecessorWorkItemId, value.Type }).IsUnique();
        dependency.HasIndex(value => new { value.SiteId, value.PredecessorWorkItemId });
        dependency.HasOne(value => value.PredecessorWorkItem).WithMany().HasForeignKey(value => value.PredecessorWorkItemId).OnDelete(DeleteBehavior.Restrict);
        dependency.HasOne(value => value.DependentWorkItem).WithMany().HasForeignKey(value => value.DependentWorkItemId).OnDelete(DeleteBehavior.Restrict);
        dependency.HasOne<Site>().WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        dependency.HasOne<Person>().WithMany().HasForeignKey(value => value.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);
    }
}
