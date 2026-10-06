namespace Fylkren.Api.DomainEvents;

public sealed class WebhookSubscription
{
    private WebhookSubscription() { }
    public WebhookSubscription(Guid id, Guid siteId, string name, string endpointUrl, string protectedSecret, string eventTypes, Guid createdByPersonId, DateTimeOffset now)
    { Id = id; SiteId = siteId; Name = name; EndpointUrl = endpointUrl; ProtectedSecret = protectedSecret; EventTypes = eventTypes; CreatedByPersonId = createdByPersonId; CreatedAt = now; UpdatedAt = now; IsActive = true; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string EndpointUrl { get; private set; } = string.Empty;
    public string ProtectedSecret { get; private set; } = string.Empty;
    public string EventTypes { get; private set; } = string.Empty;
    public Guid CreatedByPersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public bool IsActive { get; private set; }
    public void Deactivate(DateTimeOffset now) { IsActive = false; UpdatedAt = now; }
    internal void ReprotectSecret(string protectedSecret) => ProtectedSecret = protectedSecret;
    public IReadOnlySet<string> SelectedEventTypes() => EventTypes.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
}

public sealed class WebhookDelivery
{
    private WebhookDelivery() { }
    public WebhookDelivery(Guid id, Guid subscriptionId, Guid domainEventId, DateTimeOffset now)
    { Id = id; SubscriptionId = subscriptionId; DomainEventId = domainEventId; Status = "pending"; NextAttemptAt = now; CreatedAt = now; }
    public Guid Id { get; private set; }
    public Guid SubscriptionId { get; private set; }
    public WebhookSubscription Subscription { get; private set; } = null!;
    public Guid DomainEventId { get; private set; }
    public DomainEvent DomainEvent { get; private set; } = null!;
    public string Status { get; private set; } = "pending";
    public int AttemptCount { get; private set; }
    public DateTimeOffset NextAttemptAt { get; private set; }
    public DateTimeOffset? LastAttemptAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public int? LastHttpStatus { get; private set; }
    public string? LastError { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public void Start(DateTimeOffset now) { var nextAttempt = NumericBounds.NextVersion(AttemptCount); Status = "delivering"; LastAttemptAt = now; AttemptCount = nextAttempt; }
    public void Succeed(DateTimeOffset now, int status) { Status = "succeeded"; CompletedAt = now; LastHttpStatus = status; LastError = null; }
    public void Fail(DateTimeOffset now, int? status, string error, TimeSpan delay, bool terminal) { Status = terminal ? "failed" : "retry"; NextAttemptAt = now.Add(delay); LastHttpStatus = status; LastError = error[..Math.Min(error.Length, 1000)]; }
}

public sealed class WebhookDeliveryAttempt
{
    private WebhookDeliveryAttempt() { }
    public WebhookDeliveryAttempt(Guid id, Guid deliveryId, int attemptNumber, DateTimeOffset attemptedAt, long durationMs, string outcome, int? httpStatus, string? error)
    { Id = id; DeliveryId = deliveryId; AttemptNumber = attemptNumber; AttemptedAt = attemptedAt; DurationMs = durationMs; Outcome = outcome; HttpStatus = httpStatus; Error = error?[..Math.Min(error.Length, 1000)]; }
    public Guid Id { get; private set; }
    public Guid DeliveryId { get; private set; }
    public WebhookDelivery Delivery { get; private set; } = null!;
    public int AttemptNumber { get; private set; }
    public DateTimeOffset AttemptedAt { get; private set; }
    public long DurationMs { get; private set; }
    public string Outcome { get; private set; } = string.Empty;
    public int? HttpStatus { get; private set; }
    public string? Error { get; private set; }
}
