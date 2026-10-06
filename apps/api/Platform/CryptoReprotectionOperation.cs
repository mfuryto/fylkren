namespace Fylkren.Api.Platform;

public sealed class CryptoReprotectionOperation
{
    private CryptoReprotectionOperation() { }
    public CryptoReprotectionOperation(Guid id, Guid createdByPersonId, string backupReference,
        string rollbackReference, int totalItems, DateTimeOffset now)
    {
        if (id == Guid.Empty || createdByPersonId == Guid.Empty || totalItems < 0 ||
            string.IsNullOrWhiteSpace(backupReference) || backupReference.Length > 200 ||
            backupReference.Any(char.IsControl) || string.IsNullOrWhiteSpace(rollbackReference) ||
            rollbackReference.Length > 500 || rollbackReference.Any(char.IsControl))
            throw new ArgumentException("A bounded re-protection operation and recovery references are required.");
        Id = id; CreatedByPersonId = createdByPersonId; BackupReference = backupReference.Trim();
        RollbackReference = rollbackReference.Trim(); TotalItems = totalItems; CreatedAt = now;
        Status = totalItems == 0 ? "completed" : "pending";
        if (totalItems == 0) CompletedAt = now;
    }

    public Guid Id { get; private set; }
    public Guid CreatedByPersonId { get; private set; }
    public string BackupReference { get; private set; } = string.Empty;
    public string RollbackReference { get; private set; } = string.Empty;
    public string Status { get; private set; } = "pending";
    public int TotalItems { get; private set; }
    public int CompletedItems { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset? FailedAt { get; private set; }
    public string? FailureCode { get; private set; }

    public void RecordBatch(int completed, DateTimeOffset now)
    {
        if (completed < 0 || CompletedItems > TotalItems - completed)
            throw new InvalidOperationException("Re-protection progress is invalid.");
        StartedAt ??= now; CompletedItems += completed; FailureCode = null; FailedAt = null;
        if (CompletedItems == TotalItems) { Status = "completed"; CompletedAt = now; }
        else Status = "pending";
    }

    public void RecordFailure(string code, DateTimeOffset now)
    {
        StartedAt ??= now; Status = "failed"; FailedAt = now;
        FailureCode = string.IsNullOrWhiteSpace(code) ? "reprotection_failed" : code[..Math.Min(code.Length, 100)];
    }
}

public sealed class CryptoReprotectionItem
{
    private CryptoReprotectionItem() { }
    public CryptoReprotectionItem(Guid id, Guid operationId, string store, string recordKey, string slot)
    { Id = id; OperationId = operationId; Store = store; RecordKey = recordKey; Slot = slot; }
    public Guid Id { get; private set; }
    public Guid OperationId { get; private set; }
    public CryptoReprotectionOperation Operation { get; private set; } = null!;
    public string Store { get; private set; } = string.Empty;
    public string RecordKey { get; private set; } = string.Empty;
    public string Slot { get; private set; } = string.Empty;
    public DateTimeOffset? CompletedAt { get; private set; }
    public void Complete(DateTimeOffset now) => CompletedAt = now;
}
