using Fylkren.Api.Learning;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class LearningModelConfiguration
{
    internal static void ConfigureLearning(this ModelBuilder modelBuilder)
    {
        var lesson = modelBuilder.Entity<LearningLesson>();
        lesson.ToTable("learning_lessons");
        lesson.HasKey(value => value.Id);
        lesson.Property(value => value.Id).HasColumnName("id");
        lesson.Property(value => value.SiteId).HasColumnName("site_id");
        lesson.Property(value => value.WorkItemId).HasColumnName("work_item_id");
        lesson.Property(value => value.UnitId).HasColumnName("unit_id");
        lesson.Property(value => value.Number).HasColumnName("number");
        lesson.Property(value => value.Kind).HasColumnName("kind").HasMaxLength(20).IsRequired();
        lesson.Property(value => value.Text).HasColumnName("text").HasMaxLength(4000).IsRequired();
        lesson.Property(value => value.AuthorPersonId).HasColumnName("author_person_id");
        lesson.Property(value => value.AuthorName).HasColumnName("author_name").HasMaxLength(200).IsRequired();
        lesson.Property(value => value.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
        lesson.Property(value => value.Priority).HasColumnName("priority").HasMaxLength(20).IsRequired();
        lesson.Property(value => value.ActionPlan).HasColumnName("action_plan").HasMaxLength(2000).IsRequired();
        lesson.Property(value => value.TreatmentNote).HasColumnName("treatment_note").HasMaxLength(4000).IsRequired();
        lesson.Property(value => value.DueOn).HasColumnName("due_on");
        lesson.Property(value => value.OwnerPersonId).HasColumnName("owner_person_id");
        lesson.Property(value => value.OwnerName).HasColumnName("owner_name").HasMaxLength(200);
        lesson.Property(value => value.CreatedAt).HasColumnName("created_at");
        lesson.Property(value => value.UpdatedAt).HasColumnName("updated_at");
        lesson.Property(value => value.Version).HasColumnName("version").IsConcurrencyToken();
        lesson.HasOne<Site>().WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        lesson.HasOne<WorkItem>().WithMany().HasForeignKey(value => value.WorkItemId).OnDelete(DeleteBehavior.Restrict);
        lesson.HasOne<OrganizationUnit>().WithMany().HasForeignKey(value => value.UnitId).OnDelete(DeleteBehavior.Restrict);
        lesson.HasOne<Person>().WithMany().HasForeignKey(value => value.AuthorPersonId).OnDelete(DeleteBehavior.Restrict);
        lesson.HasOne<Person>().WithMany().HasForeignKey(value => value.OwnerPersonId).OnDelete(DeleteBehavior.Restrict);
        lesson.HasIndex(value => new { value.WorkItemId, value.Number }).IsUnique();
        lesson.HasIndex(value => new { value.UnitId, value.Status, value.Priority });
        lesson.HasIndex(value => value.SiteId);
        lesson.HasIndex(value => value.AuthorPersonId);
        lesson.HasIndex(value => value.OwnerPersonId);
        var entry = modelBuilder.Entity<LearningEntry>();
        entry.ToTable("learning_entries");
        entry.HasKey(value => value.Id);
        entry.Property(value => value.Id).HasColumnName("id");
        entry.Property(value => value.SiteId).HasColumnName("site_id");
        entry.Property(value => value.LessonId).HasColumnName("lesson_id");
        entry.Property(value => value.AuthorPersonId).HasColumnName("author_person_id");
        entry.Property(value => value.AuthorName).HasColumnName("author_name").HasMaxLength(200).IsRequired();
        entry.Property(value => value.Kind).HasColumnName("kind").HasMaxLength(20).IsRequired();
        entry.Property(value => value.Text).HasColumnName("text").HasMaxLength(4000).IsRequired();
        entry.Property(value => value.Status).HasColumnName("status").HasMaxLength(20);
        entry.Property(value => value.Priority).HasColumnName("priority").HasMaxLength(20);
        entry.Property(value => value.ActionPlan).HasColumnName("action_plan").HasMaxLength(2000);
        entry.Property(value => value.DueOn).HasColumnName("due_on");
        entry.Property(value => value.CreatedAt).HasColumnName("created_at");
        entry.HasOne<Site>().WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        entry.HasOne<LearningLesson>().WithMany().HasForeignKey(value => value.LessonId).OnDelete(DeleteBehavior.Restrict);
        entry.HasOne<Person>().WithMany().HasForeignKey(value => value.AuthorPersonId).OnDelete(DeleteBehavior.Restrict);
        entry.HasIndex(value => new { value.LessonId, value.CreatedAt, value.Id });
        entry.HasIndex(value => value.SiteId);
        entry.HasIndex(value => value.AuthorPersonId);
    }
}
