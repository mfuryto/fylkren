using Fylkren.Api.Identity;

namespace Fylkren.Api.WorkManagement;

public sealed class ExecutionRun
{
    private ExecutionRun() { }
    public ExecutionRun(Guid id, Guid workItemId, Guid claimedByPersonId, DateTimeOffset now)
    { Id = id; WorkItemId = workItemId; ClaimedByPersonId = claimedByPersonId; Status = "claimed"; ClaimedAt = now; UpdatedAt = now; }
    public Guid Id { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid? DefinitionId { get; private set; }
    public Guid? ClaimedByPersonId { get; private set; }
    public string Status { get; private set; } = "";
    public int CurrentStep { get; private set; }
    public DateOnly? TimelineStartedOn { get; private set; }
    public DateTimeOffset ClaimedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public WorkItem WorkItem { get; private set; } = null!;
    public WorkflowDefinition? Definition { get; private set; }
    public Person? ClaimedByPerson { get; private set; }
    public ICollection<ExecutionStepDocument> Documents { get; } = [];
    public ICollection<ExecutionExternalRequest> ExternalRequests { get; } = [];
    public ICollection<ExecutionTimelineEvent> TimelineEvents { get; } = [];
    public void Start(Guid definitionId, DateTimeOffset now) { DefinitionId = definitionId; Status = "in_progress"; CurrentStep = 0; UpdatedAt = now; }
    public void InitializeTimeline(DateOnly date) => TimelineStartedOn ??= date;
    public void Advance(int step, DateTimeOffset now) { CurrentStep = step; UpdatedAt = now; }
    public void Release(DateTimeOffset now) { ClaimedByPersonId = null; Status = "available"; UpdatedAt = now; }
    public void Claim(Guid personId, DateTimeOffset now) { ClaimedByPersonId = personId; Status = DefinitionId is null ? "claimed" : "in_progress"; UpdatedAt = now; }
    public void Submit(DateTimeOffset now) { Status = "submitted"; UpdatedAt = now; }
    public void Return(DateTimeOffset now) { Status = "in_progress"; UpdatedAt = now; }
    public void Cancel(DateTimeOffset now) { ClaimedByPersonId = null; Status = "cancelled"; UpdatedAt = now; }
}

public sealed class ExecutionTimelineEvent
{
    private ExecutionTimelineEvent() { }
    public ExecutionTimelineEvent(Guid id, Guid runId, Guid stepId, DateOnly date, string description, int sortOrder)
    { Id = id; RunId = runId; StepId = stepId; Date = date; Description = description.Trim(); SortOrder = sortOrder; }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public DateOnly Date { get; private set; }
    public string Description { get; private set; } = ""; public int SortOrder { get; private set; }
    public ExecutionRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!;
}

public sealed class ExecutionStepDocument
{
    private ExecutionStepDocument() { }
    public ExecutionStepDocument(Guid id, Guid runId, Guid stepId, string content, DateTimeOffset now) { Id = id; RunId = runId; StepId = stepId; Update(content, now); }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public string Content { get; private set; } = ""; public DateTimeOffset UpdatedAt { get; private set; }
    public ExecutionRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!;
    public void Update(string content, DateTimeOffset now) { Content = content.Trim(); UpdatedAt = now; }
}

public sealed class ExecutionExternalRequest
{
    private ExecutionExternalRequest() { }
    public ExecutionExternalRequest(Guid id, Guid runId, Guid stepId, string recipient, string requestText, DateTimeOffset now)
    { Id = id; RunId = runId; StepId = stepId; Recipient = recipient.Trim(); RequestText = requestText.Trim(); Status = "awaiting_response"; CreatedAt = now; UpdatedAt = now; }
    public Guid Id { get; private set; }
    public Guid RunId { get; private set; }
    public Guid StepId { get; private set; }
    public string Recipient { get; private set; } = ""; public string RequestText { get; private set; } = ""; public string? ResponseText { get; private set; }
    public string Status { get; private set; } = ""; public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public ExecutionRun Run { get; private set; } = null!; public WorkflowStep Step { get; private set; } = null!;
    public void RecordResponse(string response, DateTimeOffset now) { ResponseText = response.Trim(); Status = "answered"; UpdatedAt = now; }
}
