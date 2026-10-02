namespace Fylkren.Api.Learning;

public sealed class LearningLesson
{
    private LearningLesson() { }
    public LearningLesson(Guid id, Guid siteId, Guid workItemId, Guid unitId, int number, string kind, string text, Guid authorPersonId, string authorName, DateTimeOffset now)
    {
        Id = id; SiteId = siteId; WorkItemId = workItemId; UnitId = unitId; Number = number;
        Kind = kind; Text = text; AuthorPersonId = authorPersonId; AuthorName = authorName;
        CreatedAt = UpdatedAt = now;
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid UnitId { get; private set; }
    public int Number { get; private set; }
    public string Kind { get; private set; } = "";
    public string Text { get; private set; } = "";
    public Guid AuthorPersonId { get; private set; }
    public string AuthorName { get; private set; } = "";
    public string Status { get; private set; } = "new";
    public string Priority { get; private set; } = "normal";
    public string ActionPlan { get; private set; } = "";
    public string TreatmentNote { get; private set; } = "";
    public DateOnly? DueOn { get; private set; }
    public Guid? OwnerPersonId { get; private set; }
    public string? OwnerName { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public long Version { get; private set; } = 1;
    public void Review(string status, string priority, string actionPlan, string treatmentNote, DateOnly? dueOn, Guid personId, string authorName, DateTimeOffset now)
    {
        Status = status; Priority = priority; ActionPlan = actionPlan; TreatmentNote = treatmentNote; DueOn = dueOn;
        OwnerPersonId = personId; OwnerName = authorName; UpdatedAt = now; Version++;
    }
}

public sealed class LearningEntry
{
    private LearningEntry() { }
    public LearningEntry(Guid id, Guid siteId, Guid lessonId, Guid authorPersonId, string authorName, string kind, string text, DateTimeOffset now,
        string? status = null, string? priority = null, string? actionPlan = null, DateOnly? dueOn = null)
    {
        Id = id; SiteId = siteId; LessonId = lessonId; AuthorPersonId = authorPersonId; AuthorName = authorName;
        Kind = kind; Text = text; CreatedAt = now; Status = status; Priority = priority; ActionPlan = actionPlan; DueOn = dueOn;
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid LessonId { get; private set; }
    public Guid AuthorPersonId { get; private set; }
    public string AuthorName { get; private set; } = "";
    public string Kind { get; private set; } = "";
    public string Text { get; private set; } = "";
    public string? Status { get; private set; }
    public string? Priority { get; private set; }
    public string? ActionPlan { get; private set; }
    public DateOnly? DueOn { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}
