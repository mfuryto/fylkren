namespace Fylkren.Api.Platform;

public sealed class ClassificationSettings
{
    private ClassificationSettings() { }
    public ClassificationSettings(Guid id) { Id = id; }
    public Guid Id { get; private set; }
    public bool IsEnabled { get; private set; }
    public void SetEnabled(bool enabled) => IsEnabled = enabled;
}

public sealed class ClassificationDefinition
{
    private ClassificationDefinition() { }
    public ClassificationDefinition(Guid id, string name, string abbreviation, int sortOrder)
    {
        Id = id;
        Update(name, abbreviation, sortOrder, true);
    }
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Abbreviation { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public void Update(string name, string abbreviation, int sortOrder, bool isActive)
    {
        Name = name.Trim();
        Abbreviation = abbreviation.Trim().ToUpperInvariant();
        SortOrder = sortOrder;
        IsActive = isActive;
    }
}
