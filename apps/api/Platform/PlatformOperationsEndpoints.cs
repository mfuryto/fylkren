using System.Reflection;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class PlatformOperationsEndpoints
{
    private static readonly DateTimeOffset StartedAt = DateTimeOffset.UtcNow;

    public static IEndpointRouteBuilder MapPlatformOperationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/operations")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapGet("", async (FylkrenDbContext database, IWebHostEnvironment environment,
            FylkrenOptions options, HostStatusReader hostStatusReader, CancellationToken cancellationToken) =>
        {
            var checkedAt = DateTimeOffset.UtcNow;
            var databaseHealthy = false;
            string? databaseError = null;
            try
            {
                databaseHealthy = await database.Database.CanConnectAsync(cancellationToken);
            }
            catch (Exception exception)
            {
                databaseError = exception.GetType().Name;
            }

            var version = Assembly.GetExecutingAssembly().GetName().Version;
            var hostStatus = hostStatusReader.Read(checkedAt);
            var snapshot = hostStatus.Snapshot;
            var stale = hostStatus.Problem == "stale";
            var services = new List<OperationServiceStatus>
            {
                new("api", "API", "healthy", "Applikasjonen svarer.", null),
                new("database", "Database", databaseHealthy ? "healthy" : "down",
                    databaseHealthy ? "Tilkoblingen fungerer." : $"Tilkoblingen feilet{(databaseError is null ? "." : $" ({databaseError}).")}", null),
                new("authentication", "Autentisering", "healthy", "Sesjon og tilgangskontroll er aktiv.", null)
            };
            if (snapshot is not null)
            {
                services.AddRange(snapshot.Services.Select(service => new OperationServiceStatus(
                    $"host-{service.Key}", service.Name, stale ? "unknown" : service.Status,
                    stale ? "Vertsmålingen er for gammel." : service.Detail, service.RestartCount)));
                var freePercent = snapshot.Disk!.AvailableBytes * 100d / snapshot.Disk.TotalBytes;
                var diskDegraded = snapshot.Disk.AvailableBytes < 5L * 1024 * 1024 * 1024 || freePercent < 15;
                services.Add(new("host-disk", snapshot.Disk.Name,
                    stale ? "unknown" : diskDegraded ? "degraded" : "healthy",
                    stale ? "Vertsmålingen er for gammel." : $"{freePercent:F0} % ledig kapasitet.", null));
                var lastBackup = snapshot.Backup?.LastCompletedAt;
                var backupDegraded = lastBackup is null || checkedAt - lastBackup > TimeSpan.FromHours(options.Operations.BackupWarningHours);
                var backupDetail = stale
                    ? "Vertsmålingen er for gammel."
                    : lastBackup is null
                        ? $"Ingen fullført Fylkren-backup er registrert. Status er redusert etter {options.Operations.BackupWarningHours} timer uten registrert backup."
                        : backupDegraded
                            ? $"Sist fullført {lastBackup.Value:yyyy-MM-dd HH:mm} UTC. Mer enn {options.Operations.BackupWarningHours} timer har gått; ekstern kopiering overvåkes ikke av Fylkren."
                            : $"Sist fullført {lastBackup.Value:yyyy-MM-dd HH:mm} UTC. Grensen for redusert status er {options.Operations.BackupWarningHours} timer; ekstern kopiering overvåkes ikke av Fylkren.";
                services.Add(new("host-backup", "Backup",
                    stale ? "unknown" : backupDegraded ? "degraded" : "healthy",
                    backupDetail, null));
            }
            return Results.Ok(new
            {
                checkedAt,
                version = version is null ? "0.0.0" : $"{version.Major}.{version.Minor}.{version.Build}",
                environment = environment.EnvironmentName,
                startedAt = StartedAt,
                uptimeSeconds = Math.Max(0, (long)(checkedAt - StartedAt).TotalSeconds),
                processMemoryBytes = Environment.WorkingSet,
                services,
                hostIntegration = new
                {
                    hostStatus.Configured,
                    available = snapshot is not null,
                    stale,
                    hostStatus.Problem,
                    snapshot?.CollectedAt,
                    snapshot?.Platform,
                    snapshot?.Hostname,
                    disk = snapshot?.Disk,
                    backup = snapshot?.Backup,
                    backupWarningHours = options.Operations.BackupWarningHours
                }
            });
        });

        group.MapGet("/logs", (string? level, string? search, int? limit, TechnicalLogBuffer buffer) =>
        {
            if (RequestQueryPolicy.Validate(null, search) is { } queryError) return queryError;
            var minimumLevel = Enum.TryParse<LogLevel>(level, true, out var parsed) ? parsed : LogLevel.Warning;
            return Results.Ok(new
            {
                entries = buffer.Read(minimumLevel, search, limit ?? 100),
                retainedMaximum = 300,
                minimumCapturedLevel = LogLevel.Warning.ToString()
            });
        });

        return endpoints;
    }

    private sealed record OperationServiceStatus(string Key, string Name, string Status,
        string Detail, int? RestartCount);
}
