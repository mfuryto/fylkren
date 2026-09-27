namespace Fylkren.Api.Risks;

public sealed class Risk
{
    private Risk() { }
    public Risk(Guid id, Guid siteId, string objectType, Guid objectId, Guid createdBy, DateTimeOffset now) { Id = id; SiteId = siteId; ObjectType = objectType; ObjectId = objectId; CreatedByPersonId = createdBy; CreatedAt = now; }
    public Guid Id { get; private set; } public Guid SiteId { get; private set; } public string ObjectType { get; private set; } = "task"; public Guid ObjectId { get; private set; } public Guid CreatedByPersonId { get; private set; } public DateTimeOffset CreatedAt { get; private set; }
    public ICollection<RiskRevision> Revisions { get; } = []; public ICollection<RiskMitigation> Mitigations { get; } = [];
}
public sealed class RiskRevision
{
    private RiskRevision() { }
    public RiskRevision(Guid id, Guid riskId, int version, string title, string description, int probability, int impact, Guid ownerId, string ownerName, string status, DateOnly? dueDate, int? residualProbability, int? residualImpact, Guid recordedBy, DateTimeOffset now)
    { Id=id;RiskId=riskId;Version=version;Title=title.Trim();Description=description.Trim();Probability=probability;Impact=impact;Score=probability*impact;Level=RiskScoring.Level(Score);OwnerPersonId=ownerId;OwnerNameSnapshot=ownerName;Status=status;DueDate=dueDate;ResidualProbability=residualProbability;ResidualImpact=residualImpact;ResidualScore=residualProbability*residualImpact;ResidualLevel=ResidualScore is int score?RiskScoring.Level(score):null;RecordedByPersonId=recordedBy;RecordedAt=now; }
    public Guid Id{get;private set;} public Guid RiskId{get;private set;} public int Version{get;private set;} public string Title{get;private set;}=""; public string Description{get;private set;}=""; public int Probability{get;private set;} public int Impact{get;private set;} public int Score{get;private set;} public string Level{get;private set;}=""; public Guid OwnerPersonId{get;private set;} public string OwnerNameSnapshot{get;private set;}=""; public string Status{get;private set;}=""; public DateOnly? DueDate{get;private set;} public int? ResidualProbability{get;private set;} public int? ResidualImpact{get;private set;} public int? ResidualScore{get;private set;} public string? ResidualLevel{get;private set;} public Guid RecordedByPersonId{get;private set;} public DateTimeOffset RecordedAt{get;private set;}
}
public sealed class RiskMitigation
{
    private RiskMitigation() { } public RiskMitigation(Guid id,Guid riskId,Guid createdBy,DateTimeOffset now){Id=id;RiskId=riskId;CreatedByPersonId=createdBy;CreatedAt=now;}
    public Guid Id{get;private set;} public Guid RiskId{get;private set;} public Risk Risk{get;private set;}=null!; public Guid CreatedByPersonId{get;private set;} public DateTimeOffset CreatedAt{get;private set;} public ICollection<RiskMitigationRevision> Revisions{get;}=[];
}
public sealed class RiskMitigationRevision
{
    private RiskMitigationRevision() { } public RiskMitigationRevision(Guid id,Guid mitigationId,int version,string action,Guid ownerId,string ownerName,string status,DateOnly? dueDate,Guid recordedBy,DateTimeOffset now){Id=id;MitigationId=mitigationId;Version=version;Action=action.Trim();OwnerPersonId=ownerId;OwnerNameSnapshot=ownerName;Status=status;DueDate=dueDate;RecordedByPersonId=recordedBy;RecordedAt=now;}
    public Guid Id{get;private set;} public Guid MitigationId{get;private set;} public int Version{get;private set;} public string Action{get;private set;}=""; public Guid OwnerPersonId{get;private set;} public string OwnerNameSnapshot{get;private set;}=""; public string Status{get;private set;}=""; public DateOnly? DueDate{get;private set;} public Guid RecordedByPersonId{get;private set;} public DateTimeOffset RecordedAt{get;private set;}
}
internal static class RiskScoring { internal static string Level(int score)=>score switch{<=4=>"low",<=9=>"moderate",<=16=>"high",_=>"critical"}; }
