namespace Fylkren.Api.Licensing;

internal sealed class InstalledLicense
{
    private InstalledLicense() { }
    internal InstalledLicense(string payload, string signature, Guid importedBy, DateTimeOffset importedAt)
    {
        Key = 1;
        Payload = payload;
        Signature = signature;
        ImportedBy = importedBy;
        ImportedAt = importedAt;
    }

    public int Key { get; private set; }
    public string Payload { get; private set; } = "";
    public string Signature { get; private set; } = "";
    public Guid ImportedBy { get; private set; }
    public DateTimeOffset ImportedAt { get; private set; }

    internal void Replace(string payload, string signature, Guid actor, DateTimeOffset now)
    {
        Payload = payload;
        Signature = signature;
        ImportedBy = actor;
        ImportedAt = now;
    }
}
