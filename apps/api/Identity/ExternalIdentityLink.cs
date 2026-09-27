namespace Fylkren.Api.Identity;

public sealed class ExternalIdentityLink
{
    private ExternalIdentityLink() { }
    public ExternalIdentityLink(Guid id, Guid personId, string provider, string subjectId, string? username, DateTimeOffset createdAt)
    {
        Id = id; PersonId = personId; Provider = provider.Trim().ToLowerInvariant(); SubjectId = subjectId.Trim();
        Username = string.IsNullOrWhiteSpace(username) ? null : username.Trim(); CreatedAt = createdAt; IsActive = true;
    }
    public Guid Id { get; private set; }
    public Guid PersonId { get; private set; }
    public string Provider { get; private set; } = "";
    public string SubjectId { get; private set; } = "";
    public string? Username { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Person Person { get; private set; } = null!;
    public void UpdateUsername(string? username) => Username = string.IsNullOrWhiteSpace(username) ? null : username.Trim();
    public void Reactivate(Guid personId, string? username)
    {
        PersonId = personId;
        UpdateUsername(username);
        IsActive = true;
    }
    public void Deactivate() => IsActive = false;
}
