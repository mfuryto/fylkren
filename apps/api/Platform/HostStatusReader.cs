using System.Text.Json;

namespace Fylkren.Api.Platform;

public sealed class HostStatusReader(FylkrenOptions options, ILogger<HostStatusReader> logger)
{
    private const long MaximumFileBytes = 64 * 1024;
    private static readonly HashSet<string> AllowedStatuses = ["healthy", "degraded", "down", "unknown"];
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public HostStatusReadResult Read(DateTimeOffset now)
    {
        var path = options.Operations.HostStatusPath;
        if (string.IsNullOrWhiteSpace(path)) return new(false, null, "not-configured");
        try
        {
            var file = new FileInfo(path);
            if (!file.Exists) return new(true, null, "not-reported");
            if (file.Length is <= 0 or > MaximumFileBytes) return Invalid("invalid-file");
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read,
                FileShare.ReadWrite | FileShare.Delete, 16_384, FileOptions.SequentialScan);
            var snapshot = JsonSerializer.Deserialize<HostStatusSnapshot>(stream, JsonOptions);
            if (!Valid(snapshot, now)) return Invalid("invalid-content");
            return new(true, snapshot, now - snapshot!.CollectedAt >
                TimeSpan.FromMinutes(options.Operations.HostStatusMaximumAgeMinutes) ? "stale" : null);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            logger.LogWarning(new EventId(4201, "HostStatusReadFailed"), exception,
                "Host status snapshot could not be read.");
            return new(true, null, "read-failed");
        }
    }

    private HostStatusReadResult Invalid(string reason)
    {
        logger.LogWarning(new EventId(4202, "HostStatusInvalid"),
            "Host status snapshot was rejected; reason={Reason}", reason);
        return new(true, null, reason);
    }

    private static bool Valid(HostStatusSnapshot? value, DateTimeOffset now) =>
        value is not null && value.SchemaVersion == 1 &&
        value.CollectedAt > DateTimeOffset.UnixEpoch && value.CollectedAt <= now.AddMinutes(5) &&
        Safe(value.Platform, 80) && Safe(value.Hostname, 255) &&
        value.Disk is not null && Safe(value.Disk.Name, 100) &&
        value.Disk.TotalBytes > 0 && value.Disk.AvailableBytes >= 0 && value.Disk.AvailableBytes <= value.Disk.TotalBytes &&
        value.Services is { Count: <= 20 } && value.Services.All(service =>
            Safe(service.Key, 40) && Safe(service.Name, 100) && Safe(service.Detail, 300) &&
            AllowedStatuses.Contains(service.Status) && service.RestartCount is >= 0 and <= 1_000_000) &&
        (value.Backup is null || value.Backup.LastCompletedAt is null ||
            value.Backup.LastCompletedAt > DateTimeOffset.UnixEpoch && value.Backup.LastCompletedAt <= now.AddMinutes(5)) &&
        (value.Time is null ||
            AllowedStatuses.Contains(value.Time.Status) && Safe(value.Time.Source, 100) && Safe(value.Time.Detail, 300) &&
            value.Time.MaximumAllowedOffsetMilliseconds is >= 1 and <= 60_000 &&
            (value.Time.OffsetMilliseconds is null ||
                double.IsFinite(value.Time.OffsetMilliseconds.Value) && Math.Abs(value.Time.OffsetMilliseconds.Value) <= 86_400_000));

    private static bool Safe(string? value, int maximum) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= maximum && !value.Any(char.IsControl);
}

public sealed record HostStatusReadResult(bool Configured, HostStatusSnapshot? Snapshot, string? Problem);
public sealed record HostStatusSnapshot(int SchemaVersion, DateTimeOffset CollectedAt, string Platform,
    string Hostname, HostDiskStatus? Disk, HostBackupStatus? Backup, HostTimeStatus? Time, List<HostServiceStatus> Services);
public sealed record HostDiskStatus(string Name, long TotalBytes, long AvailableBytes);
public sealed record HostBackupStatus(DateTimeOffset? LastCompletedAt);
public sealed record HostTimeStatus(bool Synchronized, string Status, string Source,
    double? OffsetMilliseconds, double MaximumAllowedOffsetMilliseconds, string Detail);
public sealed record HostServiceStatus(string Key, string Name, string Status, string Detail, int RestartCount);
