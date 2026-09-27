using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class WorkflowModelConfiguration
{
    internal static void ConfigureWorkflows(this ModelBuilder modelBuilder)
    {
        ConfigureDefinition(modelBuilder);
        ConfigureStep(modelBuilder);
        ConfigurePlanningRun(modelBuilder);
        ConfigurePlanAllocation(modelBuilder);
        ConfigurePlanRequest(modelBuilder);
        ConfigurePlanningRfi(modelBuilder);
        ConfigurePlanningDocument(modelBuilder);
        ConfigurePlanningLink(modelBuilder);
        ConfigureStepTemplate(modelBuilder);
        ConfigurePlanningTimeline(modelBuilder);
        ConfigureExecutionRun(modelBuilder);
        ConfigureExecutionDocument(modelBuilder);
        ConfigureExternalRequest(modelBuilder);
        ConfigureExecutionTimeline(modelBuilder);
    }

    private static void ConfigureDefinition(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowDefinition>();
        entity.ToTable("workflow_definitions");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.SiteId).HasColumnName("site_id");
        entity.Property(x => x.OwnerUnitId).HasColumnName("owner_unit_id");
        entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200);
        entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(30);
        entity.Property(x => x.IsSystem).HasColumnName("is_system");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.HasIndex(x => new { x.SiteId, x.Kind, x.IsActive, x.OwnerUnitId });
        entity.HasOne(x => x.Site).WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.OwnerUnit).WithMany().HasForeignKey(x => x.OwnerUnitId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureStep(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowStep>();
        entity.ToTable("workflow_steps");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.DefinitionId).HasColumnName("definition_id");
        entity.Property(x => x.TemplateId).HasColumnName("template_id");
        entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200);
        entity.Property(x => x.SortOrder).HasColumnName("sort_order");
        entity.Property(x => x.IsOptional).HasColumnName("is_optional");
        entity.Property(x => x.AllowsTaskAllocation).HasColumnName("allows_task_allocation");
        entity.Property(x => x.HasTimeline).HasColumnName("has_timeline");
        entity.HasIndex(x => new { x.DefinitionId, x.SortOrder }).IsUnique();
        entity.HasOne(x => x.Definition).WithMany(x => x.Steps).HasForeignKey(x => x.DefinitionId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Template).WithMany().HasForeignKey(x => x.TemplateId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurePlanningRun(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowRun>();
        entity.ToTable("workflow_runs");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.WorkItemId).HasColumnName("work_item_id");
        entity.Property(x => x.DefinitionId).HasColumnName("definition_id");
        entity.Property(x => x.ClaimedByPersonId).HasColumnName("claimed_by_person_id");
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
        entity.Property(x => x.CurrentStep).HasColumnName("current_step");
        entity.Property(x => x.StartedAt).HasColumnName("started_at");
        entity.Property(x => x.TimelineStartedOn).HasColumnName("timeline_started_on");
        entity.Property(x => x.ProposedUnitId).HasColumnName("proposed_unit_id");
        entity.Property(x => x.ProposedPriority).HasColumnName("proposed_priority").HasMaxLength(20);
        entity.Property(x => x.ProposedDueAt).HasColumnName("proposed_due_at");
        entity.Property(x => x.ResultNote).HasColumnName("result_note").HasMaxLength(10000);
        entity.Property<uint>("xmin").IsRowVersion();
        entity.HasIndex(x => x.WorkItemId).IsUnique();
        entity.HasOne(x => x.WorkItem).WithOne(x => x.WorkflowRun).HasForeignKey<WorkflowRun>(x => x.WorkItemId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.Definition).WithMany().HasForeignKey(x => x.DefinitionId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.ClaimedByPerson).WithMany().HasForeignKey(x => x.ClaimedByPersonId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.ProposedUnit).WithMany().HasForeignKey(x => x.ProposedUnitId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurePlanAllocation(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowPlanAllocation>();
        entity.ToTable("workflow_plan_allocations");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.UnitId).HasColumnName("unit_id");
        entity.Property(x => x.Instruction).HasColumnName("instruction").HasMaxLength(10000);
        entity.HasIndex(x => new { x.RunId, x.StepId, x.UnitId }).IsUnique();
        entity.HasOne(x => x.Run).WithMany(x => x.Allocations).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurePlanRequest(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowPlanRequest>();
        entity.ToTable("workflow_plan_requests");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.TargetSiteId).HasColumnName("target_site_id");
        entity.Property(x => x.TargetInstanceId).HasColumnName("target_instance_id");
        entity.Property(x => x.RemoteSiteId).HasColumnName("remote_site_id");
        entity.Property(x => x.TargetSiteNameSnapshot).HasColumnName("target_site_name_snapshot").HasMaxLength(200);
        entity.Property(x => x.Instruction).HasColumnName("instruction").HasMaxLength(2000);
        entity.HasIndex(x => new { x.RunId, x.StepId, x.TargetSiteId }).IsUnique()
            .HasFilter("target_site_id IS NOT NULL");
        entity.HasIndex(x => new { x.RunId, x.StepId, x.TargetInstanceId, x.RemoteSiteId }).IsUnique()
            .HasFilter("target_instance_id IS NOT NULL AND remote_site_id IS NOT NULL");
        entity.ToTable("workflow_plan_requests", table => table.HasCheckConstraint(
            "CK_workflow_plan_requests_recipient", "(target_site_id IS NOT NULL AND target_instance_id IS NULL AND remote_site_id IS NULL AND target_site_name_snapshot IS NULL) OR (target_site_id IS NULL AND target_instance_id IS NOT NULL AND remote_site_id IS NOT NULL AND NULLIF(BTRIM(target_site_name_snapshot), '') IS NOT NULL)"));
        entity.HasOne(x => x.Run).WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.TargetSite).WithMany().HasForeignKey(x => x.TargetSiteId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurePlanningRfi(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<PlanningRfiEntry>();
        entity.ToTable("planning_rfi_entries");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.Who).HasColumnName("who").HasMaxLength(320);
        entity.Property(x => x.What).HasColumnName("what").HasMaxLength(10000);
        entity.Property(x => x.DueOn).HasColumnName("due_on");
        entity.Property(x => x.Answered).HasColumnName("answered");
        entity.Property(x => x.Answer).HasColumnName("answer").HasMaxLength(10000);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.RunId, x.CreatedAt });
        entity.HasOne(x => x.Run).WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigurePlanningDocument(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowStepDocument>();
        entity.ToTable("workflow_step_documents");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.Content).HasColumnName("content").HasMaxLength(20000);
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.Property<uint>("xmin").IsRowVersion();
        entity.HasIndex(x => new { x.RunId, x.StepId }).IsUnique();
        entity.HasOne(x => x.Run).WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurePlanningLink(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowStepLink>();
        entity.ToTable("workflow_step_links");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(240);
        entity.Property(x => x.Url).HasColumnName("url").HasMaxLength(2048);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.RunId, x.StepId });
        entity.HasOne(x => x.Run).WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureStepTemplate(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowStepTemplate>();
        entity.ToTable("workflow_step_templates");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.SiteId).HasColumnName("site_id");
        entity.Property(x => x.OwnerUnitId).HasColumnName("owner_unit_id");
        entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150);
        entity.Property(x => x.Content).HasColumnName("content").HasMaxLength(20000);
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.SiteId, x.Name })
            .IsUnique()
            .HasDatabaseName("ix_workflow_step_templates_site_name")
            .HasFilter("is_active AND owner_unit_id IS NULL");
        entity.HasIndex(x => new { x.SiteId, x.OwnerUnitId, x.Name })
            .IsUnique()
            .HasDatabaseName("ix_workflow_step_templates_site_owner_name")
            .HasFilter("is_active AND owner_unit_id IS NOT NULL");
        entity.HasOne(x => x.Site).WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.OwnerUnit).WithMany().HasForeignKey(x => x.OwnerUnitId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurePlanningTimeline(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WorkflowTimelineEvent>();
        entity.ToTable("workflow_timeline_events");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.Date).HasColumnName("date");
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
        entity.Property(x => x.SortOrder).HasColumnName("sort_order");
        entity.HasIndex(x => new { x.RunId, x.StepId, x.SortOrder }).IsUnique();
        entity.HasOne(x => x.Run).WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureExecutionRun(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ExecutionRun>();
        entity.ToTable("execution_runs");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.WorkItemId).HasColumnName("work_item_id");
        entity.Property(x => x.DefinitionId).HasColumnName("definition_id");
        entity.Property(x => x.ClaimedByPersonId).HasColumnName("claimed_by_person_id");
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
        entity.Property(x => x.CurrentStep).HasColumnName("current_step");
        entity.Property(x => x.TimelineStartedOn).HasColumnName("timeline_started_on");
        entity.Property(x => x.ClaimedAt).HasColumnName("claimed_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.Property<uint>("xmin").IsRowVersion();
        entity.HasIndex(x => x.WorkItemId).IsUnique();
        entity.HasOne(x => x.WorkItem).WithOne(x => x.ExecutionRun).HasForeignKey<ExecutionRun>(x => x.WorkItemId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.Definition).WithMany().HasForeignKey(x => x.DefinitionId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.ClaimedByPerson).WithMany().HasForeignKey(x => x.ClaimedByPersonId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureExecutionDocument(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ExecutionStepDocument>();
        entity.ToTable("execution_step_documents");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.Content).HasColumnName("content").HasMaxLength(20000);
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.Property<uint>("xmin").IsRowVersion();
        entity.HasIndex(x => new { x.RunId, x.StepId }).IsUnique();
        entity.HasOne(x => x.Run).WithMany(x => x.Documents).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureExternalRequest(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ExecutionExternalRequest>();
        entity.ToTable("execution_external_requests");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.Recipient).HasColumnName("recipient").HasMaxLength(320);
        entity.Property(x => x.RequestText).HasColumnName("request_text").HasMaxLength(10000);
        entity.Property(x => x.ResponseText).HasColumnName("response_text").HasMaxLength(10000);
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.RunId, x.StepId });
        entity.HasOne(x => x.Run).WithMany(x => x.ExternalRequests).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureExecutionTimeline(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ExecutionTimelineEvent>();
        entity.ToTable("execution_timeline_events");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.RunId).HasColumnName("run_id");
        entity.Property(x => x.StepId).HasColumnName("step_id");
        entity.Property(x => x.Date).HasColumnName("date");
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
        entity.Property(x => x.SortOrder).HasColumnName("sort_order");
        entity.HasIndex(x => new { x.RunId, x.StepId, x.SortOrder }).IsUnique();
        entity.HasOne(x => x.Run).WithMany(x => x.TimelineEvents).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Step).WithMany().HasForeignKey(x => x.StepId).OnDelete(DeleteBehavior.Restrict);
    }
}
