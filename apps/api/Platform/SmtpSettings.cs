namespace Fylkren.Api.Platform;

public sealed class SmtpSettings
{
    private SmtpSettings() { }
    public SmtpSettings(Guid id) { Id = id; }
    public Guid Id { get; private set; }
    public bool Enabled { get; private set; }
    public string Host { get; private set; } = "";
    public int Port { get; private set; } = 587;
    public string Security { get; private set; } = "starttls";
    public string? Username { get; private set; }
    public string? ProtectedPassword { get; private set; }
    public string FromAddress { get; private set; } = "";
    public string FromName { get; private set; } = "";
    public DateTimeOffset? LastTestedAt { get; private set; }
    public bool? LastTestSucceeded { get; private set; }
    public string? LastTestError { get; private set; }
    public void Update(bool enabled, string host, int port, string security, string? username, string? protectedPassword, string fromAddress, string fromName) { Enabled = enabled; Host = host; Port = port; Security = security; Username = string.IsNullOrWhiteSpace(username) ? null : username; ProtectedPassword = protectedPassword; FromAddress = fromAddress; FromName = fromName; }
    public void RecordTest(bool succeeded, string? error) { LastTestedAt = DateTimeOffset.UtcNow; LastTestSucceeded = succeeded; LastTestError = error; }
}
