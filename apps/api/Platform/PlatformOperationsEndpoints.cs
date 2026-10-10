using System.Reflection;
using System.Runtime.InteropServices;
using System.Data;
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
            string? databaseVersion = null;
            try
            {
                databaseHealthy = await database.Database.CanConnectAsync(cancellationToken);
                if (databaseHealthy)
                {
                    var connection = database.Database.GetDbConnection();
                    var closeAfterRead = connection.State != ConnectionState.Open;
                    if (closeAfterRead) await connection.OpenAsync(cancellationToken);
                    try
                    {
                        await using var command = connection.CreateCommand();
                        command.CommandText = "SHOW server_version";
                        databaseVersion = (await command.ExecuteScalarAsync(cancellationToken))?.ToString();
                    }
                    finally
                    {
                        if (closeAfterRead) await connection.CloseAsync();
                    }
                }
            }
            catch (Exception exception)
            {
                databaseError = exception.GetType().Name;
            }

            var hostStatus = hostStatusReader.Read(checkedAt);
            var snapshot = hostStatus.Snapshot;
            var stale = hostStatus.Problem == "stale";
            var webRuntime = snapshot?.Services.FirstOrDefault(service => service.Key == "web")?.Runtime;
            var services = new List<OperationServiceStatus>
            {
                new("api", "API", "healthy", "The application is responding.", null),
                new("database", "Database", databaseHealthy ? "healthy" : "down",
                    databaseHealthy ? "The connection is healthy." : $"The connection failed{(databaseError is null ? "." : $" ({databaseError}).")}", null),
                new("authentication", "Authentication", "healthy", "Session and access control are active.", null),
                new("mfa-policy", "Multi-factor authentication",
                    options.Authentication.MfaRequired ? "healthy" : "degraded",
                    options.Authentication.MfaRequired
                        ? "Multi-factor authentication is required for interactive access."
                        : options.Authentication.MfaEnabled
                            ? "A documented deployment exception is active. Multi-factor authentication is available but optional."
                            : "A documented deployment exception is active. Multi-factor authentication is unavailable.",
                    null)
            };
            if (snapshot is not null)
            {
                services.AddRange(snapshot.Services.Select(service => new OperationServiceStatus(
                    $"host-{service.Key}", service.Name, stale ? "unknown" : service.Status,
                    stale ? "The host measurement is too old." : service.Detail, service.RestartCount)));
                var freePercent = snapshot.Disk!.AvailableBytes * 100d / snapshot.Disk.TotalBytes;
                var diskDegraded = snapshot.Disk.AvailableBytes < 5L * 1024 * 1024 * 1024 || freePercent < 15;
                services.Add(new("host-disk", snapshot.Disk.Name,
                    stale ? "unknown" : diskDegraded ? "degraded" : "healthy",
                    stale ? "The host measurement is too old." : $"{freePercent:F0}% free capacity.", null));
                var lastBackup = snapshot.Backup?.LastCompletedAt;
                var backupDegraded = lastBackup is null || checkedAt - lastBackup > TimeSpan.FromHours(options.Operations.BackupWarningHours);
                var backupDetail = stale
                    ? "The host measurement is too old."
                    : lastBackup is null
                        ? $"No completed Fylkren backup has been recorded. Status becomes degraded after {options.Operations.BackupWarningHours} hours without a recorded backup."
                        : backupDegraded
                            ? $"Last completed {lastBackup.Value:yyyy-MM-dd HH:mm} UTC. More than {options.Operations.BackupWarningHours} hours have elapsed; Fylkren does not monitor off-host copying."
                            : $"Last completed {lastBackup.Value:yyyy-MM-dd HH:mm} UTC. The degraded-status threshold is {options.Operations.BackupWarningHours} hours; Fylkren does not monitor off-host copying.";
                services.Add(new("host-backup", "Backup",
                    stale ? "unknown" : backupDegraded ? "degraded" : "healthy",
                    backupDetail, null));
                if (snapshot.Time is not null)
                    services.Add(new("host-time", "Time synchronization",
                        stale ? "unknown" : snapshot.Time.Status,
                        stale ? "The host measurement is too old." : snapshot.Time.Detail, null));
            }
            return Results.Ok(new
            {
                checkedAt,
                version = PublicConfigurationEndpoints.ProductVersion(),
                environment = environment.EnvironmentName,
                startedAt = StartedAt,
                uptimeSeconds = Math.Max(0, (long)(checkedAt - StartedAt).TotalSeconds),
                processMemoryBytes = Environment.WorkingSet,
                runtime = new
                {
                    product = new { name = "Fylkren", version = PublicConfigurationEndpoints.ProductVersion() },
                    webServer = webRuntime is null ? null : new { webRuntime.Name, webRuntime.Version },
                    apiFramework = new
                    {
                        name = "ASP.NET Core",
                        version = typeof(WebApplication).Assembly
                            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion?.Split('+', 2)[0]
                    },
                    dotnetRuntime = new { name = ".NET", version = Environment.Version.ToString() },
                    database = new { name = "PostgreSQL", version = databaseVersion },
                    apiOperatingSystem = new
                    {
                        name = RuntimeInformation.OSDescription,
                        runtimeIdentifier = RuntimeInformation.RuntimeIdentifier,
                        architecture = RuntimeInformation.ProcessArchitecture.ToString()
                    },
                    hostOperatingSystem = snapshot?.Runtime is null ? null : new
                    {
                        name = snapshot.Runtime.OperatingSystemName,
                        version = snapshot.Runtime.OperatingSystemVersion,
                        kernelVersion = snapshot.Runtime.KernelVersion,
                        architecture = snapshot.Runtime.Architecture
                    },
                    containerEngine = snapshot?.Runtime is null ? null : new
                    {
                        name = snapshot.Runtime.ContainerEngineName,
                        version = snapshot.Runtime.ContainerEngineVersion
                    }
                },
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
                    time = snapshot?.Time,
                    backupWarningHours = options.Operations.BackupWarningHours
                }
            });
        });

        group.MapGet("/logs", (string? level, string? search, int? limit, TechnicalLogBuffer buffer) =>
        {
            if (RequestQueryPolicy.Validate(null, search) is { } queryError) return queryError;
            if (RequestQueryPolicy.ValidateChoice("level", level, "Warning", "Error", "Critical", "None") is { } levelError) return levelError;
            if (RequestQueryPolicy.ValidateLimit(limit, 300) is { } limitError) return limitError;
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
