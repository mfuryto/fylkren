using Fylkren.Api.Decisions;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class DecisionModelConfiguration
{
    internal static void ConfigureDecisions(this ModelBuilder modelBuilder)
    {
        var decision = modelBuilder.Entity<Decision>();
        decision.ToTable("decisions");
        decision.HasKey(value => value.Id);
        decision.Property(value => value.Id).HasColumnName("id");
        decision.Property(value => value.SiteId).HasColumnName("site_id");
        decision.Property(value => value.CreatedByPersonId).HasColumnName("created_by_person_id");
        decision.Property(value => value.CreatedByMachineId).HasColumnName("created_by_machine_id");
        decision.Property(value => value.CreatedAt).HasColumnName("created_at");
        decision.HasIndex(value => new { value.SiteId, value.CreatedAt });
        decision.HasOne(value => value.Site).WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        decision.HasOne(value => value.CreatedByPerson).WithMany().HasForeignKey(value => value.CreatedByPersonId).OnDelete(DeleteBehavior.Restrict);
        decision.HasOne(value => value.CreatedByMachine).WithMany().HasForeignKey(value => value.CreatedByMachineId).OnDelete(DeleteBehavior.Restrict);
        decision.ToTable(table => table.HasCheckConstraint("CK_decisions_actor", "(created_by_person_id IS NOT NULL) <> (created_by_machine_id IS NOT NULL)"));

        var revision = modelBuilder.Entity<DecisionRevision>();
        revision.ToTable("decision_revisions");
        revision.HasKey(value => value.Id);
        revision.Property(value => value.Id).HasColumnName("id");
        revision.Property(value => value.DecisionId).HasColumnName("decision_id");
        revision.Property(value => value.RevisionNumber).HasColumnName("revision_number");
        revision.Property(value => value.Title).HasColumnName("title").HasMaxLength(200);
        revision.Property(value => value.DecisionText).HasColumnName("decision_text").HasMaxLength(10000);
        revision.Property(value => value.Rationale).HasColumnName("rationale").HasMaxLength(10000);
        revision.Property(value => value.Status).HasColumnName("status").HasMaxLength(30);
        revision.Property(value => value.DecidedAt).HasColumnName("decided_at");
        revision.Property(value => value.RecordedByPersonId).HasColumnName("recorded_by_person_id");
        revision.Property(value => value.RecordedByMachineId).HasColumnName("recorded_by_machine_id");
        revision.Property(value => value.RecordedAt).HasColumnName("recorded_at");
        revision.HasIndex(value => new { value.DecisionId, value.RevisionNumber }).IsUnique();
        revision.HasOne(value => value.Decision).WithMany(value => value.Revisions).HasForeignKey(value => value.DecisionId).OnDelete(DeleteBehavior.Restrict);
        revision.HasOne(value => value.RecordedByPerson).WithMany().HasForeignKey(value => value.RecordedByPersonId).OnDelete(DeleteBehavior.Restrict);
        revision.HasOne(value => value.RecordedByMachine).WithMany().HasForeignKey(value => value.RecordedByMachineId).OnDelete(DeleteBehavior.Restrict);
        revision.ToTable(table => table.HasCheckConstraint("CK_decision_revisions_actor", "(recorded_by_person_id IS NOT NULL) <> (recorded_by_machine_id IS NOT NULL)"));

        var maker = modelBuilder.Entity<DecisionMaker>();
        maker.ToTable("decision_makers");
        maker.HasKey(value => new { value.RevisionId, value.PersonId });
        maker.Property(value => value.RevisionId).HasColumnName("revision_id");
        maker.Property(value => value.PersonId).HasColumnName("person_id");
        maker.Property(value => value.DisplayNameSnapshot).HasColumnName("display_name_snapshot").HasMaxLength(200);
        maker.HasOne(value => value.Revision).WithMany(value => value.Makers).HasForeignKey(value => value.RevisionId).OnDelete(DeleteBehavior.Restrict);

        var reference = modelBuilder.Entity<DecisionReference>();
        reference.ToTable("decision_references");
        reference.HasKey(value => value.Id);
        reference.Property(value => value.Id).HasColumnName("id");
        reference.Property(value => value.RevisionId).HasColumnName("revision_id");
        reference.Property(value => value.ObjectType).HasColumnName("object_type").HasMaxLength(30);
        reference.Property(value => value.ObjectId).HasColumnName("object_id");
        reference.HasIndex(value => new { value.ObjectType, value.ObjectId });
        reference.HasIndex(value => new { value.RevisionId, value.ObjectType, value.ObjectId }).IsUnique();
        reference.HasOne(value => value.Revision).WithMany(value => value.References).HasForeignKey(value => value.RevisionId).OnDelete(DeleteBehavior.Restrict);
    }
}
