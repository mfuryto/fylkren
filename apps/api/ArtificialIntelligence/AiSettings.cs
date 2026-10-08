namespace Fylkren.Api.ArtificialIntelligence;

public sealed class AiSettings
{
    private AiSettings() { }
    public AiSettings(Guid id) => Id = id;
    public Guid Id { get; private set; }
    public bool Enabled { get; private set; }
    public string EndpointUrl { get; private set; } = "https://api.openai.com/v1/chat/completions";
    public string Model { get; private set; } = "";
    public string? ProtectedApiKey { get; private set; }
    public bool SummaryEnabled { get; private set; } = true;
    public bool DraftsEnabled { get; private set; } = true;
    public bool LearningEnabled { get; private set; } = true;
    public bool QuestionsEnabled { get; private set; } = true;
    public DateTimeOffset? LastTestedAt { get; private set; }
    public bool? LastTestSucceeded { get; private set; }
    public string? LastTestError { get; private set; }
    public void Update(bool enabled, string endpointUrl, string model, string? protectedApiKey,
        bool summaryEnabled, bool draftsEnabled, bool learningEnabled, bool questionsEnabled)
    {
        Enabled = enabled; EndpointUrl = endpointUrl.Trim(); Model = model.Trim(); ProtectedApiKey = protectedApiKey;
        SummaryEnabled = summaryEnabled; DraftsEnabled = draftsEnabled;
        LearningEnabled = learningEnabled; QuestionsEnabled = questionsEnabled;
        LastTestedAt = null; LastTestSucceeded = null; LastTestError = null;
    }
    public void RecordTest(bool succeeded, string? error, DateTimeOffset now)
    {
        LastTestedAt = now; LastTestSucceeded = succeeded;
        var detail = error?.Trim(); LastTestError = string.IsNullOrWhiteSpace(detail) ? null : detail[..Math.Min(detail.Length, 300)];
    }
    internal void ReprotectApiKey(string protectedApiKey) => ProtectedApiKey = protectedApiKey;
}

public sealed class AiSiteAccess
{
    private AiSiteAccess() { }
    public AiSiteAccess(Guid siteId, DateTimeOffset createdAt) { SiteId = siteId; CreatedAt = createdAt; }
    public Guid SiteId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}
