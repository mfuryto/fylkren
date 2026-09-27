namespace Fylkren.Api.Notifications;

public sealed class NotificationTemplate
{
    private NotificationTemplate() { }
    public NotificationTemplate(Guid id, string key, string subject, string body) { Id = id; Key = key; Subject = subject; Body = body; }
    public Guid Id { get; private set; }
    public string Key { get; private set; } = ""; public string Subject { get; private set; } = ""; public string Body { get; private set; } = "";
    public void Update(string subject, string body) { Subject = subject; Body = body; }
}
