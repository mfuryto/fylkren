using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Notifications;
using Fylkren.Api.Organization;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class AuditModelConfiguration
{
    internal static void ConfigureAudit(this ModelBuilder modelBuilder)
    {
        var auditEvent = modelBuilder.Entity<AuditEvent>();
        auditEvent.ToTable("audit_events", table => table.HasCheckConstraint(
            "CK_audit_events_actor_origin",
            "(actor_person_id IS NOT NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL AND actor_system IS NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND NULLIF(BTRIM(actor_site_name), '') IS NOT NULL AND actor_system IS NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NULL AND actor_site_name IS NULL AND actor_system IS NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL AND NULLIF(BTRIM(actor_system), '') IS NOT NULL)"));
        auditEvent.Property(value => value.DomainEventId).HasColumnName("domain_event_id");
        auditEvent.Property(value => value.CorrelationId).HasColumnName("correlation_id");
        auditEvent.Property(value => value.ChangeReason).HasColumnName("change_reason").HasMaxLength(1000);
        auditEvent.HasKey(value => value.Id);
        auditEvent.Property(value => value.Id).HasColumnName("id");
        auditEvent.Property(value => value.SiteId).HasColumnName("site_id");
        auditEvent.Property(value => value.ActorPersonId).HasColumnName("actor_person_id");
        auditEvent.Property(value => value.ActorInstanceId).HasColumnName("actor_instance_id");
        auditEvent.Property(value => value.ActorSiteId).HasColumnName("actor_site_id");
        auditEvent.Property(value => value.ActorSiteName).HasColumnName("actor_site_name").HasMaxLength(200);
        auditEvent.Property(value => value.ActorSystem).HasColumnName("actor_system").HasMaxLength(100);
        auditEvent.Property(value => value.EventType).HasColumnName("event_type").HasMaxLength(100).IsRequired();
        auditEvent.Property(value => value.EntityType).HasColumnName("entity_type").HasMaxLength(100).IsRequired();
        auditEvent.Property(value => value.EntityId).HasColumnName("entity_id");
        auditEvent.Property(value => value.OccurredAt).HasColumnName("occurred_at");
        auditEvent.Property(value => value.ActorWasPlatformManager).HasColumnName("actor_was_platform_manager");
        auditEvent.HasIndex(value => new { value.SiteId, value.OccurredAt });
        auditEvent.HasIndex(value => new { value.OccurredAt, value.Id });
    }
}
