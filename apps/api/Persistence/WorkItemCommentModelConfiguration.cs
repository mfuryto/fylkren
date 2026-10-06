using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class WorkItemCommentModelConfiguration
{
    internal static void ConfigureWorkItemComments(this ModelBuilder modelBuilder)
    {
        var comment = modelBuilder.Entity<WorkItemComment>();
        comment.ToTable("work_item_comments", table => table.HasCheckConstraint(
            "CK_work_item_comments_author", "author_person_id IS NOT NULL OR author_machine_id IS NOT NULL"));
        comment.HasKey(value => value.Id);
        comment.Property(value => value.Id).HasColumnName("id");
        comment.Property(value => value.SiteId).HasColumnName("site_id");
        comment.Property(value => value.WorkItemId).HasColumnName("work_item_id");
        comment.Property(value => value.AuthorPersonId).HasColumnName("author_person_id");
        comment.Property(value => value.AuthorMachineId).HasColumnName("author_machine_id");
        comment.Property(value => value.AuthorName).HasColumnName("author_name").HasMaxLength(200).IsRequired();
        comment.Property(value => value.Text).HasColumnName("text").HasMaxLength(10000).IsRequired();
        comment.Property(value => value.CreatedAt).HasColumnName("created_at");
        comment.HasIndex(value => new { value.WorkItemId, value.CreatedAt, value.Id });
        comment.HasOne<WorkItem>().WithMany().HasForeignKey(value => value.WorkItemId).OnDelete(DeleteBehavior.Restrict);
        comment.HasOne<Site>().WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        comment.HasOne<Person>().WithMany().HasForeignKey(value => value.AuthorPersonId).OnDelete(DeleteBehavior.Restrict);
        comment.HasOne<ApiMachineIdentity>().WithMany().HasForeignKey(value => value.AuthorMachineId).OnDelete(DeleteBehavior.Restrict);
    }
}
