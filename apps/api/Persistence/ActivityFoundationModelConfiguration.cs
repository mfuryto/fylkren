using Fylkren.Api.DomainEvents;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Organization;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class ActivityFoundationModelConfiguration
{
    internal static void ConfigureActivityFoundation(this ModelBuilder m)
    {
        var e = m.Entity<DomainEvent>();
        e.ToTable("domain_events", t => t.HasCheckConstraint("CK_domain_events_activity_context", "source = 'legacy' OR (recorded_at IS NOT NULL AND origin_instance_id IS NOT NULL AND origin_site_id IS NOT NULL AND operation_id IS NOT NULL AND activity_type IS NOT NULL AND effect_key IS NOT NULL AND ((source = 'local' AND actor_kind = 'person' AND actor_person_id IS NOT NULL AND actor_machine_id IS NULL AND actor_system IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL) OR (source = 'local' AND actor_kind = 'machine' AND actor_person_id IS NULL AND actor_machine_id IS NOT NULL AND actor_system IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL) OR (source = 'system' AND actor_kind = 'system' AND actor_system IS NOT NULL AND actor_person_id IS NULL AND actor_machine_id IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL) OR (source = 'federated' AND actor_kind = 'federated-site' AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND actor_person_id IS NULL AND actor_machine_id IS NULL AND actor_system IS NULL)))"));
        e.Property(x => x.ActivityType).HasColumnName("activity_type").HasMaxLength(100);
        e.Property(x => x.ActivityMetadataJson).HasColumnName("activity_metadata_json").HasColumnType("jsonb").HasDefaultValue("{}");
        e.Property(x => x.Source).HasColumnName("source").HasMaxLength(20).HasDefaultValue("legacy");
        e.Property(x => x.ActorKind).HasColumnName("actor_kind").HasMaxLength(30).HasDefaultValue("legacy-unknown");
        e.Property(x => x.RecordedAt).HasColumnName("recorded_at");
        e.Property(x => x.OriginInstanceId).HasColumnName("origin_instance_id"); e.Property(x => x.OriginSiteId).HasColumnName("origin_site_id");
        e.Property(x => x.OperationId).HasColumnName("operation_id"); e.Property(x => x.EffectKey).HasColumnName("effect_key").HasMaxLength(100);
        e.Property(x => x.ActorMachineId).HasColumnName("actor_machine_id"); e.Property(x => x.ActorSystem).HasColumnName("actor_system").HasMaxLength(100);
        e.Property(x => x.ActorInstanceId).HasColumnName("actor_instance_id"); e.Property(x => x.ActorSiteId).HasColumnName("actor_site_id");
        e.Property(x => x.ContextWorkItemId).HasColumnName("context_work_item_id"); e.Property(x => x.CorrelationId).HasColumnName("correlation_id");
        e.Property(x => x.CausationEventId).HasColumnName("causation_event_id"); e.Property(x => x.RequestId).HasColumnName("request_id").HasMaxLength(200);
        e.Property(x => x.SourceMessageId).HasColumnName("source_message_id");
        e.HasIndex(x => new { x.SiteId, x.ContextWorkItemId, x.OccurredAt, x.Id });
        e.HasIndex(x => new { x.SiteId, x.ResourceType, x.ResourceId, x.OccurredAt, x.Id });
        e.HasIndex(x => new { x.OperationId, x.SiteId, x.ResourceType, x.ResourceId, x.ActivityType, x.EffectKey }).IsUnique();
        var p = m.Entity<EventProjection>(); p.ToTable("event_projections", t => t.HasCheckConstraint("CK_event_projections_state", "consumer IN ('notifications', 'webhooks') AND status IN ('pending', 'processing', 'completed', 'skipped') AND attempt_count >= 0 AND ((status = 'processing' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'processing' AND lease_owner IS NULL AND lease_expires_at IS NULL))")); p.HasKey(x => new { x.Consumer, x.DomainEventId });
        p.Property(x => x.Consumer).HasColumnName("consumer").HasMaxLength(40); p.Property(x => x.DomainEventId).HasColumnName("domain_event_id");
        p.Property(x => x.Status).HasColumnName("status").HasMaxLength(20); p.Property(x => x.LeaseOwner).HasColumnName("lease_owner").IsConcurrencyToken();
        p.Property(x => x.LeaseExpiresAt).HasColumnName("lease_expires_at"); p.Property(x => x.AttemptCount).HasColumnName("attempt_count");
        p.Property(x => x.NextAttemptAt).HasColumnName("next_attempt_at"); p.Property(x => x.LastError).HasColumnName("last_error").HasMaxLength(300);
        p.Property(x => x.CompletedAt).HasColumnName("completed_at"); p.HasIndex(x => new { x.Consumer, x.Status, x.NextAttemptAt });
        p.HasOne<DomainEvent>().WithMany().HasForeignKey(x => x.DomainEventId).OnDelete(DeleteBehavior.Restrict);
        var l = m.Entity<InformationLifecycleRecord>(); l.ToTable("information_lifecycle", t => t.HasCheckConstraint("CK_information_lifecycle_reversible", "stage IN ('active', 'closed', 'archived') AND version > 0 AND (owner_site_id IS NOT NULL OR context_work_item_id IS NULL)")); l.HasKey(x => x.Id);
        l.Property(x => x.Id).HasColumnName("id"); l.Property(x => x.OwnerSiteId).HasColumnName("owner_site_id");
        l.Property(x => x.ResourceType).HasColumnName("resource_type").HasMaxLength(80); l.Property(x => x.ResourceId).HasColumnName("resource_id");
        l.Property(x => x.ContextWorkItemId).HasColumnName("context_work_item_id"); l.Property(x => x.Stage).HasColumnName("stage").HasMaxLength(20);
        l.Property(x => x.Version).HasColumnName("version").IsConcurrencyToken(); l.Property(x => x.ChangedAt).HasColumnName("changed_at");
        l.Property(x => x.ClosedAt).HasColumnName("closed_at"); l.Property(x => x.ArchivedAt).HasColumnName("archived_at");
        l.Property(x => x.PolicyId).HasColumnName("policy_id"); l.Property(x => x.PolicyVersion).HasColumnName("policy_version");
        l.Property(x => x.EligibleAt).HasColumnName("eligible_at"); l.Property(x => x.ExportId).HasColumnName("export_id");
        l.Property(x => x.AutomationPaused).HasColumnName("automation_paused");
        l.Property(x => x.IsHeld).HasColumnName("is_held"); l.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(1000);
        l.HasIndex(x => new { x.OwnerSiteId, x.ResourceType, x.ResourceId }).IsUnique().HasFilter("owner_site_id IS NOT NULL");
        l.HasIndex(x => new { x.ResourceType, x.ResourceId }).IsUnique().HasFilter("owner_site_id IS NULL");
        l.HasOne<Site>().WithMany().HasForeignKey(x => x.OwnerSiteId).OnDelete(DeleteBehavior.Restrict);
        l.HasOne<WorkItem>().WithMany().HasForeignKey(x => x.ContextWorkItemId).OnDelete(DeleteBehavior.Restrict);
    }
}
