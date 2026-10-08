using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Platform;

namespace Fylkren.Api.Decisions;

public sealed class Decision
{
    private Decision() { }
    public Decision(Guid id, Guid siteId, Guid createdByPersonId, DateTimeOffset createdAt)
    { Id = id; SiteId = siteId; CreatedByPersonId = createdByPersonId; CreatedAt = createdAt; }
    public static Decision FromMachine(Guid id, Guid siteId, Guid createdByMachineId, DateTimeOffset createdAt) =>
        new() { Id = id, SiteId = siteId, CreatedByMachineId = createdByMachineId, CreatedAt = createdAt };
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? CreatedByPersonId { get; private set; }
    public Guid? CreatedByMachineId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public Person? CreatedByPerson { get; private set; }
    public ApiMachineIdentity? CreatedByMachine { get; private set; }
    public ICollection<DecisionRevision> Revisions { get; } = [];
}

public sealed class DecisionRevision
{
    private DecisionRevision() { }
    public DecisionRevision(Guid id, Guid decisionId, int revisionNumber, string title, string decisionText, string rationale, string status, DateTimeOffset decidedAt, Guid recordedByPersonId, DateTimeOffset recordedAt)
    { Id = id; DecisionId = decisionId; RevisionNumber = revisionNumber; Title = title.Trim(); DecisionText = decisionText.Trim(); Rationale = rationale.Trim(); Status = status; DecidedAt = decidedAt; RecordedByPersonId = recordedByPersonId; RecordedAt = recordedAt; }
    public static DecisionRevision FromMachine(Guid id, Guid decisionId, int revisionNumber, string title,
        string decisionText, string rationale, DateTimeOffset decidedAt, Guid recordedByMachineId,
        DateTimeOffset recordedAt) => new()
        { Id = id, DecisionId = decisionId, RevisionNumber = revisionNumber, Title = title.Trim(),
          DecisionText = decisionText.Trim(), Rationale = rationale.Trim(), Status = "draft",
          DecidedAt = decidedAt, RecordedByMachineId = recordedByMachineId, RecordedAt = recordedAt };
    public Guid Id { get; private set; }
    public Guid DecisionId { get; private set; }
    public int RevisionNumber { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string DecisionText { get; private set; } = string.Empty;
    public string Rationale { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
    public DateTimeOffset DecidedAt { get; private set; }
    public Guid? RecordedByPersonId { get; private set; }
    public Guid? RecordedByMachineId { get; private set; }
    public DateTimeOffset RecordedAt { get; private set; }
    public Decision Decision { get; private set; } = null!;
    public Person? RecordedByPerson { get; private set; }
    public ApiMachineIdentity? RecordedByMachine { get; private set; }
    public ICollection<DecisionMaker> Makers { get; } = [];
    public ICollection<DecisionReference> References { get; } = [];
}

public sealed class DecisionMaker
{
    private DecisionMaker() { }
    public DecisionMaker(Guid revisionId, Guid personId, string displayNameSnapshot)
    { RevisionId = revisionId; PersonId = personId; DisplayNameSnapshot = displayNameSnapshot.Trim(); }
    public Guid RevisionId { get; private set; }
    public Guid PersonId { get; private set; }
    public string DisplayNameSnapshot { get; private set; } = string.Empty;
    public DecisionRevision Revision { get; private set; } = null!;
}

public sealed class DecisionReference
{
    private DecisionReference() { }
    public DecisionReference(Guid id, Guid revisionId, string objectType, Guid objectId)
    { Id = id; RevisionId = revisionId; ObjectType = objectType; ObjectId = objectId; }
    public Guid Id { get; private set; }
    public Guid RevisionId { get; private set; }
    public string ObjectType { get; private set; } = string.Empty;
    public Guid ObjectId { get; private set; }
    public DecisionRevision Revision { get; private set; } = null!;
}
