using Fylkren.Api.Notifications;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class NotificationModelConfiguration
{
    internal static void ConfigureNotifications(this ModelBuilder modelBuilder)
    {
        var notificationSettings = modelBuilder.Entity<SiteNotificationSettings>();
        notificationSettings.ToTable("site_notification_settings");
        notificationSettings.HasKey(x => x.Id);
        notificationSettings.Property(x => x.Id).HasColumnName("id");
        notificationSettings.Property(x => x.SiteId).HasColumnName("site_id");
        notificationSettings.Property(x => x.NewWorkItems).HasColumnName("new_work_items");
        notificationSettings.Property(x => x.WorkItemChanges).HasColumnName("work_item_changes");
        notificationSettings.Property(x => x.DecisionsRequired).HasColumnName("decisions_required");
        notificationSettings.Property(x => x.ChildWorkCompleted).HasColumnName("child_work_completed");
        notificationSettings.Property(x => x.PlanningCompleted).HasColumnName("planning_completed");
        notificationSettings.Property(x => x.ExecutionCompleted).HasColumnName("execution_completed");
        notificationSettings.HasIndex(x => x.SiteId).IsUnique();
        notificationSettings.HasOne<Organization.Site>().WithOne().HasForeignKey<SiteNotificationSettings>(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);

        var notificationTemplate = modelBuilder.Entity<NotificationTemplate>();
        notificationTemplate.ToTable("notification_templates");
        notificationTemplate.HasKey(x => x.Id);
        notificationTemplate.Property(x => x.Id).HasColumnName("id");
        notificationTemplate.Property(x => x.Key).HasColumnName("key").HasMaxLength(50);
        notificationTemplate.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(200);
        notificationTemplate.Property(x => x.Body).HasColumnName("body").HasMaxLength(10000);
        notificationTemplate.HasIndex(x => x.Key).IsUnique();

        var outbox = modelBuilder.Entity<NotificationOutboxMessage>();
        outbox.ToTable("notification_outbox");
        outbox.Property(x => x.DomainEventId).HasColumnName("domain_event_id");
        outbox.Property(x => x.NotificationKind).HasColumnName("notification_kind").HasMaxLength(50);
        outbox.HasIndex(x => new { x.DomainEventId, x.RecipientPersonId, x.NotificationKind }).IsUnique().HasFilter("domain_event_id IS NOT NULL");
        outbox.HasKey(x => x.Id);
        outbox.Property(x => x.Id).HasColumnName("id");
        outbox.Property(x => x.AuditEventId).HasColumnName("audit_event_id");
        outbox.Property(x => x.SiteId).HasColumnName("site_id");
        outbox.Property(x => x.WorkItemId).HasColumnName("work_item_id");
        outbox.Property(x => x.RecipientPersonId).HasColumnName("recipient_person_id");
        outbox.Property(x => x.RecipientEmail).HasColumnName("recipient_email").HasMaxLength(320);
        outbox.Property(x => x.RecipientName).HasColumnName("recipient_name").HasMaxLength(200);
        outbox.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(200);
        outbox.Property(x => x.Body).HasColumnName("body").HasMaxLength(10000);
        outbox.Property(x => x.FromName).HasColumnName("from_name").HasMaxLength(200);
        outbox.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
        outbox.Property(x => x.Attempts).HasColumnName("attempts");
        outbox.Property(x => x.NextAttemptAt).HasColumnName("next_attempt_at");
        outbox.Property(x => x.CreatedAt).HasColumnName("created_at");
        outbox.Property(x => x.SentAt).HasColumnName("sent_at");
        outbox.Property(x => x.LastError).HasColumnName("last_error").HasMaxLength(300);
        outbox.HasIndex(x => new { x.AuditEventId, x.RecipientPersonId }).IsUnique();
        outbox.HasIndex(x => new { x.Status, x.NextAttemptAt });
        outbox.HasIndex(x => new { x.Status, x.CreatedAt, x.Id });
        outbox.HasIndex(x => new { x.CreatedAt, x.Id });

        var projectionCursor = modelBuilder.Entity<NotificationProjectionCursor>();
        projectionCursor.ToTable("notification_projection_cursors");
        projectionCursor.HasKey(x => x.Id);
        projectionCursor.Property(x => x.ReconciledAt).HasColumnName("reconciled_at");
        projectionCursor.Property(x => x.Id).HasColumnName("id");
        projectionCursor.Property(x => x.LastOccurredAt).HasColumnName("last_occurred_at");
        projectionCursor.Property(x => x.LastAuditEventId).HasColumnName("last_audit_event_id");

        var personalNotifications = modelBuilder.Entity<PersonalNotificationSettings>();
        personalNotifications.ToTable("personal_notification_settings");
        personalNotifications.HasKey(x => x.Id);
        personalNotifications.Property(x => x.Id).HasColumnName("id");
        personalNotifications.Property(x => x.SiteId).HasColumnName("site_id");
        personalNotifications.Property(x => x.PersonId).HasColumnName("person_id");
        personalNotifications.Property(x => x.NewWorkItems).HasColumnName("new_work_items");
        personalNotifications.Property(x => x.WorkItemChanges).HasColumnName("work_item_changes");
        personalNotifications.Property(x => x.DecisionsRequired).HasColumnName("decisions_required");
        personalNotifications.Property(x => x.ChildWorkCompleted).HasColumnName("child_work_completed");
        personalNotifications.Property(x => x.PlanningCompleted).HasColumnName("planning_completed");
        personalNotifications.Property(x => x.ExecutionCompleted).HasColumnName("execution_completed");
        personalNotifications.HasIndex(x => new { x.SiteId, x.PersonId }).IsUnique();
    }
}
