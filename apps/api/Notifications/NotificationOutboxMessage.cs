namespace Fylkren.Api.Notifications;

public sealed class NotificationOutboxMessage
{
    private NotificationOutboxMessage() { }
    public NotificationOutboxMessage(Guid id, Guid auditEventId, Guid siteId, Guid workItemId, Guid recipientPersonId, string recipientEmail, string recipientName, string subject, string body, string fromName, DateTimeOffset createdAt)
    { Id = id; AuditEventId = auditEventId; SiteId = siteId; WorkItemId = workItemId; RecipientPersonId = recipientPersonId; RecipientEmail = recipientEmail; RecipientName = recipientName; Subject = subject; Body = body; FromName = fromName; Status = "pending"; NextAttemptAt = createdAt; CreatedAt = createdAt; }
    public Guid? DomainEventId { get; private set; }
    public string? NotificationKind { get; private set; }
    public void LinkEvent(Guid id, string kind) { DomainEventId = id; NotificationKind = kind; }
    public Guid Id { get; private set; }
    public Guid AuditEventId { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid RecipientPersonId { get; private set; }
    public string RecipientEmail { get; private set; } = "";
    public string RecipientName { get; private set; } = "";
    public string Subject { get; private set; } = "";
    public string Body { get; private set; } = "";
    public string FromName { get; private set; } = "";
    public string Status { get; private set; } = "pending";
    public int Attempts { get; private set; }
    public DateTimeOffset NextAttemptAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }
    public string? LastError { get; private set; }
    public void Sent(DateTimeOffset at) { Status = "sent"; SentAt = at; LastError = null; }
    public void Failed(DateTimeOffset at, string error) { Attempts++; Status = Attempts >= 5 ? "failed" : "pending"; NextAttemptAt = at + TimeSpan.FromMinutes(Math.Pow(2, Attempts - 1)); LastError = error.Length > 300 ? error[..300] : error; }
}

public sealed class NotificationProjectionCursor
{
    private NotificationProjectionCursor() { }
    public NotificationProjectionCursor(Guid id, DateTimeOffset occurredAt, Guid auditEventId) { Id = id; LastOccurredAt = occurredAt; LastAuditEventId = auditEventId; }
    public Guid Id { get; private set; }
    public DateTimeOffset LastOccurredAt { get; private set; }
    public Guid LastAuditEventId { get; private set; }
    public DateTimeOffset? ReconciledAt { get; private set; }
    public void CompleteReconciliation(DateTimeOffset at) => ReconciledAt = at;
    public void Advance(DateTimeOffset occurredAt, Guid auditEventId) { LastOccurredAt = occurredAt; LastAuditEventId = auditEventId; }
}
