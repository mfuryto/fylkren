using Fylkren.Api.Identity;
using Fylkren.Api.Organization;

namespace Fylkren.Api.WorkManagement;

public sealed class WorkItem
{
    private WorkItem() { }
    public WorkItem(Guid id, Guid siteId, Guid? createdByPersonId, string title, string description, string? referenceUrl, string priority, DateTimeOffset? dueAt, DateTimeOffset createdAt, Guid? parentWorkItemId = null, Guid? workItemTypeId = null, Guid? sourceTypeId = null, Guid? senderId = null, string? recommendation = null, string? senderSiteName = null, string? senderPersonName = null, string? sourceTypeNameSnapshot = null, string? workItemTypeNameSnapshot = null, string? senderNameSnapshot = null, Guid? upstreamPlanWorkItemId = null, string? requestBasisSnapshot = null, string? originReference = null, Guid? originReferenceInstanceId = null)
    {
        if (createdByPersonId is null && string.IsNullOrWhiteSpace(senderSiteName))
            throw new ArgumentException("An externally created work item requires a sender-site snapshot.");
        Id = id; SiteId = siteId; ParentWorkItemId = parentWorkItemId; WorkItemTypeId = workItemTypeId; SourceTypeId = sourceTypeId; SenderId = senderId; SenderSiteName = senderSiteName; SenderPersonName = senderPersonName; SourceTypeNameSnapshot = sourceTypeNameSnapshot; WorkItemTypeNameSnapshot = workItemTypeNameSnapshot; SenderNameSnapshot = senderNameSnapshot; UpstreamPlanWorkItemId = upstreamPlanWorkItemId; RequestBasisSnapshot = string.IsNullOrWhiteSpace(requestBasisSnapshot) ? null : requestBasisSnapshot.Trim(); OriginReference = string.IsNullOrWhiteSpace(originReference) ? null : originReference.Trim().ToUpperInvariant(); OriginReferenceInstanceId = originReferenceInstanceId; CreatedByPersonId = createdByPersonId; Title = title.Trim(); Description = description.Trim(); Recommendation = string.IsNullOrWhiteSpace(recommendation) ? null : recommendation.Trim(); ReferenceUrl = string.IsNullOrWhiteSpace(referenceUrl) ? null : referenceUrl.Trim(); Priority = priority; DueAt = dueAt; Status = "registered"; CreatedAt = createdAt; UpdatedAt = createdAt;
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public string ReferenceCode { get; private set; } = string.Empty;
    public long ReferenceNumber { get; private set; }
    public string? OriginReference { get; private set; }
    public Guid? OriginReferenceInstanceId { get; private set; }
    public Guid? ParentWorkItemId { get; private set; }
    public Guid? WorkItemTypeId { get; private set; }
    public Guid? SourceTypeId { get; private set; }
    public Guid? SenderId { get; private set; }
    public string? SenderSiteName { get; private set; }
    public string? SenderPersonName { get; private set; }
    public string? SourceTypeNameSnapshot { get; private set; }
    public string? WorkItemTypeNameSnapshot { get; private set; }
    public string? SenderNameSnapshot { get; private set; }
    public Guid? UpstreamPlanWorkItemId { get; private set; }
    public string? RequestBasisSnapshot { get; private set; }
    public Guid? AssignedUnitId { get; private set; }
    public Guid? CreatedByPersonId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string? Recommendation { get; private set; }
    public string? ReferenceUrl { get; private set; }
    public string Priority { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
    public DateTimeOffset? DueAt { get; private set; }
    public string? DecisionNote { get; private set; }
    public string? FinalReport { get; private set; }
    public string? FinalReportClassification { get; private set; }
    public DateTimeOffset? FinalReportCreatedAt { get; private set; }
    public DateTimeOffset? FinalReportUpdatedAt { get; private set; }
    public Guid? FinalReportWrittenByPersonId { get; private set; }
    public Guid? FinalReportApprovedByPersonId { get; private set; }
    public DateTimeOffset? FinalReportApprovedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public WorkItem? ParentWorkItem { get; private set; }
    public ICollection<WorkItem> ChildWorkItems { get; } = [];
    public WorkflowRun? WorkflowRun { get; private set; }
    public ExecutionRun? ExecutionRun { get; private set; }
    public WorkItemType? WorkItemType { get; private set; }
    public WorkItemLookup? SourceType { get; private set; }
    public WorkItemLookup? Sender { get; private set; }
    public OrganizationUnit? AssignedUnit { get; private set; }
    public Person? CreatedByPerson { get; private set; }
    public Person? FinalReportWrittenByPerson { get; private set; }
    public Person? FinalReportApprovedByPerson { get; private set; }
    internal void AssignReference(string referenceCode, long referenceNumber)
    {
        if (!string.IsNullOrEmpty(ReferenceCode) || ReferenceNumber != 0)
            throw new InvalidOperationException("A task reference is immutable once assigned.");
        if (string.IsNullOrWhiteSpace(referenceCode) || referenceCode.Length > 80 || referenceNumber < 1)
            throw new ArgumentOutOfRangeException(nameof(referenceCode));
        ReferenceCode = referenceCode;
        ReferenceNumber = referenceNumber;
    }
    public static WorkItem CreateDelegated(Guid id, WorkItem parent, Guid createdByPersonId, Guid assignedUnitId, string assignedUnitName, string instruction, DateTimeOffset createdAt, string? requestBasisSnapshot = null)
    {
        var child = new WorkItem(id, parent.SiteId, createdByPersonId, parent.Title, instruction, parent.ReferenceUrl, parent.Priority, parent.DueAt, createdAt, parent.Id, parent.WorkItemTypeId, parent.SourceTypeId, parent.SenderId, recommendation: parent.Recommendation, requestBasisSnapshot: requestBasisSnapshot ?? parent.RequestBasisSnapshot);
        child.AssignToUnit(assignedUnitId, null, createdAt);
        return child;
    }
    public static WorkItem CreateTransferred(Guid id, WorkItem parent, Guid receivingSiteId, Guid createdByPersonId, string senderSiteName, string senderPersonName, string? sourceTypeName, string? workItemTypeName, string? senderName, Guid? upstreamPlanWorkItemId, string instruction, DateTimeOffset createdAt, string? requestBasisSnapshot = null)
    {
        return new WorkItem(id, receivingSiteId, createdByPersonId, parent.Title, instruction, parent.ReferenceUrl, parent.Priority, parent.DueAt, createdAt, parent.Id, null, null, null, parent.Recommendation, senderSiteName, senderPersonName, sourceTypeName, workItemTypeName, senderName, upstreamPlanWorkItemId, requestBasisSnapshot ?? parent.RequestBasisSnapshot);
    }
    public static WorkItem CreateInternalRequest(Guid id, WorkItem parent, Guid createdByPersonId, Guid receivingUnitId, string senderSiteName, string senderPersonName, string? sourceTypeName, string? senderName, string instruction, DateTimeOffset createdAt, string? requestBasisSnapshot = null)
    {
        var received = new WorkItem(id, parent.SiteId, createdByPersonId, parent.Title, instruction, parent.ReferenceUrl, parent.Priority, parent.DueAt, createdAt, parent.Id, parent.WorkItemTypeId, null, null, parent.Recommendation, senderSiteName, senderPersonName, sourceTypeName, "Request", senderName, requestBasisSnapshot: requestBasisSnapshot ?? parent.RequestBasisSnapshot);
        received.AssignToUnit(receivingUnitId, null, createdAt);
        return received;
    }
    public void TransitionWithinLevel(string status, string? decisionNote, DateTimeOffset updatedAt) { Status = status; DecisionNote = string.IsNullOrWhiteSpace(decisionNote) ? null : decisionNote.Trim(); UpdatedAt = updatedAt; }
    public void SetPriority(string priority, DateTimeOffset updatedAt) { Priority = priority; UpdatedAt = updatedAt; }
    public void RegisterAtUnit(Guid assignedUnitId, DateTimeOffset updatedAt) { AssignedUnitId = assignedUnitId; UpdatedAt = updatedAt; }
    public void AssignToUnit(Guid assignedUnitId, string? decisionNote, DateTimeOffset updatedAt) { AssignedUnitId = assignedUnitId; Status = "assigned"; DecisionNote = string.IsNullOrWhiteSpace(decisionNote) ? null : decisionNote.Trim(); UpdatedAt = updatedAt; }
    public void ApplyApprovedPlan(string priority, DateTimeOffset? dueAt, string? decisionNote, DateTimeOffset updatedAt) { Priority = priority; DueAt = dueAt; DecisionNote = string.IsNullOrWhiteSpace(decisionNote) ? null : decisionNote.Trim(); Status = "in_progress"; UpdatedAt = updatedAt; }
    public void CarryForwardFinalReport(WorkItem source, DateTimeOffset updatedAt) { FinalReport = source.FinalReport; FinalReportClassification = source.FinalReportClassification; FinalReportCreatedAt = source.FinalReportCreatedAt; FinalReportUpdatedAt = source.FinalReportUpdatedAt; FinalReportWrittenByPersonId = source.FinalReportWrittenByPersonId; FinalReportApprovedByPersonId = null; FinalReportApprovedAt = null; UpdatedAt = updatedAt; }
    public void AcceptFederatedOfficialReport(string content, string? classification,
        DateTimeOffset remoteApprovedAt, Guid acceptedByPersonId, DateTimeOffset acceptedAt)
    {
        if (string.IsNullOrWhiteSpace(content) || content.Length > 20_000 ||
            classification is { Length: > 20 } ||
            remoteApprovedAt == default || acceptedByPersonId == Guid.Empty || acceptedAt == default ||
            Status is "completed" or "cancelled")
            throw new InvalidOperationException("An active task and approved external report are required.");
        FinalReport = content.Trim();
        FinalReportClassification = string.IsNullOrWhiteSpace(classification)
            ? null : classification.Trim().ToUpperInvariant();
        FinalReportCreatedAt = remoteApprovedAt;
        FinalReportUpdatedAt = acceptedAt;
        FinalReportWrittenByPersonId = null;
        FinalReportApprovedByPersonId = acceptedByPersonId;
        FinalReportApprovedAt = acceptedAt;
        Status = "completed";
        UpdatedAt = acceptedAt;
    }
    public void ReopenAfterReassignment(DateTimeOffset updatedAt) { Status = "in_progress"; FinalReportApprovedByPersonId = null; FinalReportApprovedAt = null; UpdatedAt = updatedAt; }
    public void UpdateFinalReport(string finalReport, string? classification, Guid writtenByPersonId, DateTimeOffset updatedAt) { FinalReport = finalReport.Trim(); FinalReportClassification = string.IsNullOrWhiteSpace(classification) ? null : classification.Trim().ToUpperInvariant(); FinalReportCreatedAt ??= updatedAt; FinalReportUpdatedAt = updatedAt; FinalReportWrittenByPersonId = writtenByPersonId; FinalReportApprovedByPersonId = null; FinalReportApprovedAt = null; UpdatedAt = updatedAt; }
    public void ApproveFinalReport(Guid approvedByPersonId, DateTimeOffset approvedAt) { FinalReportApprovedByPersonId = approvedByPersonId; FinalReportApprovedAt = approvedAt; UpdatedAt = approvedAt; }
}
