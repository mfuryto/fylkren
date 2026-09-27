using Fylkren.Api.Identity;
using Fylkren.Api.Organization;

namespace Fylkren.Api.WorkManagement;

public sealed class WorkflowDefinition
{
    private WorkflowDefinition() { }
    public WorkflowDefinition(Guid id, Guid? siteId, Guid? ownerUnitId, string name, string kind, bool isSystem) { Id = id; SiteId = siteId; OwnerUnitId = ownerUnitId; Name = name.Trim(); Kind = kind; IsSystem = isSystem; IsActive = true; }
    public Guid Id { get; private set; }
    public Guid? SiteId { get; private set; }
    public Guid? OwnerUnitId { get; private set; }
    public string Name { get; private set; } = ""; public string Kind { get; private set; } = "custom"; public bool IsSystem { get; private set; }
    public bool IsActive { get; private set; }
    public Site? Site { get; private set; }
    public OrganizationUnit? OwnerUnit { get; private set; }
    public ICollection<WorkflowStep> Steps { get; } = [];
    public void Deactivate() => IsActive = false;
}
public sealed class WorkflowStep
{
    private WorkflowStep() { }
    public WorkflowStep(Guid id, Guid definitionId, string name, int sortOrder, bool isOptional, bool allowsTaskAllocation = false, Guid? templateId = null, bool hasTimeline = false) { Id = id; DefinitionId = definitionId; Name = name.Trim(); SortOrder = sortOrder; IsOptional = isOptional; AllowsTaskAllocation = allowsTaskAllocation; TemplateId = templateId; HasTimeline = hasTimeline; }
    public Guid Id { get; private set; }
    public Guid DefinitionId { get; private set; }
    public Guid? TemplateId { get; private set; }
    public string Name { get; private set; } = ""; public int SortOrder { get; private set; }
    public bool IsOptional { get; private set; }
    public bool AllowsTaskAllocation { get; private set; }
    public bool HasTimeline { get; private set; }
    public WorkflowDefinition Definition { get; private set; } = null!; public WorkflowStepTemplate? Template { get; private set; }
}
public sealed class WorkflowRun
{
    private WorkflowRun() { }
    public WorkflowRun(Guid id, Guid workItemId, Guid definitionId) { Id = id; WorkItemId = workItemId; DefinitionId = definitionId; Status = "available"; }
    public Guid Id { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid DefinitionId { get; private set; }
    public Guid? ClaimedByPersonId { get; private set; }
    public string Status { get; private set; } = ""; public int CurrentStep { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateOnly? TimelineStartedOn { get; private set; }
    public Guid? ProposedUnitId { get; private set; }
    public string? ProposedPriority { get; private set; }
    public DateTimeOffset? ProposedDueAt { get; private set; }
    public string? ResultNote { get; private set; }
    public WorkItem WorkItem { get; private set; } = null!; public WorkflowDefinition Definition { get; private set; } = null!; public Person? ClaimedByPerson { get; private set; }
    public OrganizationUnit? ProposedUnit { get; private set; }
    public ICollection<WorkflowPlanAllocation> Allocations { get; } = [];
    public void Claim(Guid personId, DateTimeOffset now) { ClaimedByPersonId = personId; Status = "in_progress"; StartedAt ??= now; }
    public void Release() { ClaimedByPersonId = null; Status = "available"; }
    public void InitializeTimeline(DateOnly date) => TimelineStartedOn ??= date;
    public void Advance(int step) => CurrentStep = step;
    public void Submit(Guid? unitId, string priority, DateTimeOffset? dueAt) { ProposedUnitId = unitId; ProposedPriority = priority; ProposedDueAt = dueAt; ResultNote = null; Status = "awaiting_approval"; }
    public void Return() { Status = "in_progress"; }
    public void Approve() { Status = "approved"; }
    public void Reject() { Status = "rejected"; }
    public void Cancel() { ClaimedByPersonId = null; Status = "cancelled"; }
}

public sealed class WorkflowPlanAllocation
{
    private WorkflowPlanAllocation() { }
    public WorkflowPlanAllocation(Guid id, Guid runId, Guid stepId, Guid unitId, string instruction) { Id = id; RunId = runId; StepId = stepId; UnitId = unitId; Instruction = instruction.Trim(); }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public Guid UnitId { get; private set; }
    public string Instruction { get; private set; } = "";
    public void UpdateInstruction(string instruction) => Instruction = instruction.Trim();
    public WorkflowRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!; public OrganizationUnit Unit { get; private set; } = null!;
}

public sealed class WorkflowPlanRequest
{
    private WorkflowPlanRequest() { }
    public WorkflowPlanRequest(Guid id, Guid runId, Guid stepId, Guid targetSiteId, string instruction)
    { Id = id; RunId = runId; StepId = stepId; TargetSiteId = targetSiteId; Instruction = instruction.Trim(); }
    public WorkflowPlanRequest(Guid id, Guid runId, Guid stepId, Guid targetInstanceId,
        Guid remoteSiteId, string targetSiteNameSnapshot, string instruction)
    {
        if (targetInstanceId == Guid.Empty || remoteSiteId == Guid.Empty ||
            string.IsNullOrWhiteSpace(targetSiteNameSnapshot))
            throw new ArgumentException("A qualified remote site is required.");
        Id = id; RunId = runId; StepId = stepId; TargetInstanceId = targetInstanceId;
        RemoteSiteId = remoteSiteId; TargetSiteNameSnapshot = targetSiteNameSnapshot.Trim();
        Instruction = instruction.Trim();
    }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public Guid? TargetSiteId { get; private set; }
    public Guid? TargetInstanceId { get; private set; }
    public Guid? RemoteSiteId { get; private set; }
    public string? TargetSiteNameSnapshot { get; private set; }
    public string Instruction { get; private set; } = "";
    public WorkflowRun Run { get; private set; } = null!;
    public WorkflowStep Step { get; private set; } = null!;
    public Site? TargetSite { get; private set; }
}

public sealed class PlanningRfiEntry
{
    private PlanningRfiEntry() { }
    public PlanningRfiEntry(Guid id, Guid runId, string who, string what, DateOnly? dueOn, bool answered, string answer, DateTimeOffset now)
    {
        Id = id; RunId = runId; CreatedAt = now;
        Update(who, what, dueOn, answered, answer, now);
    }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public string Who { get; private set; } = "";
    public string What { get; private set; } = "";
    public DateOnly? DueOn { get; private set; }
    public bool Answered { get; private set; }
    public string Answer { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public WorkflowRun Run { get; private set; } = null!;
    public void Update(string who, string what, DateOnly? dueOn, bool answered, string answer, DateTimeOffset now)
    {
        Who = who.Trim(); What = what.Trim(); DueOn = dueOn; Answered = answered; Answer = answer.Trim(); UpdatedAt = now;
    }
}

public sealed class WorkflowStepDocument
{
    private WorkflowStepDocument() { }
    public WorkflowStepDocument(Guid id, Guid runId, Guid stepId, string content, DateTimeOffset updatedAt) { Id = id; RunId = runId; StepId = stepId; Update(content, updatedAt); }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public string Content { get; private set; } = ""; public DateTimeOffset UpdatedAt { get; private set; }
    public WorkflowRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!;
    public void Update(string content, DateTimeOffset updatedAt) { Content = content.Trim(); UpdatedAt = updatedAt; }
}

public sealed class WorkflowStepLink
{
    private WorkflowStepLink() { }
    public WorkflowStepLink(Guid id, Guid runId, Guid stepId, string label, string url, DateTimeOffset createdAt)
    { Id = id; RunId = runId; StepId = stepId; Label = label.Trim(); Url = url.Trim(); CreatedAt = createdAt; }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public string Label { get; private set; } = ""; public string Url { get; private set; } = ""; public DateTimeOffset CreatedAt { get; private set; }
    public WorkflowRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!;
}
public sealed class WorkflowTimelineEvent
{
    private WorkflowTimelineEvent() { }
    public WorkflowTimelineEvent(Guid id, Guid runId, Guid stepId, DateOnly date, string description, int sortOrder) { Id = id; RunId = runId; StepId = stepId; Date = date; Description = description.Trim(); SortOrder = sortOrder; }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public DateOnly Date { get; private set; }
    public string Description { get; private set; } = ""; public int SortOrder { get; private set; }
    public WorkflowRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!;
}
public sealed class WorkflowStepTemplate
{
    private WorkflowStepTemplate() { }
    public WorkflowStepTemplate(Guid id, Guid siteId, Guid? ownerUnitId, string name, string content, DateTimeOffset createdAt) { Id = id; SiteId = siteId; OwnerUnitId = ownerUnitId; Name = name.Trim(); Content = content.Trim(); CreatedAt = createdAt; IsActive = true; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? OwnerUnitId { get; private set; }
    public string Name { get; private set; } = ""; public string Content { get; private set; } = ""; public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!; public OrganizationUnit? OwnerUnit { get; private set; }
    public void Update(string name, string content) { Name = name.Trim(); Content = content.Trim(); }
    public void Deactivate() => IsActive = false;
}
