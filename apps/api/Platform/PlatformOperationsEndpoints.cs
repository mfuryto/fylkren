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

        group.MapGet("", async (FylkrenDbContext database, IWebHostEnvironment environment, CancellationToken cancellationToken) =>
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
            return Results.Ok(new
            {
                checkedAt,
                version = version is null ? "0.0.0" : $"{version.Major}.{version.Minor}.{version.Build}",
                environment = environment.EnvironmentName,
                startedAt = StartedAt,
                uptimeSeconds = Math.Max(0, (long)(checkedAt - StartedAt).TotalSeconds),
                processMemoryBytes = Environment.WorkingSet,
                services = new[]
                {
                    new { key = "api", name = "API", status = "healthy", detail = "Applikasjonen svarer." },
                    new { key = "database", name = "Database", status = databaseHealthy ? "healthy" : "down", detail = databaseHealthy ? "Tilkoblingen fungerer." : $"Tilkoblingen feilet{(databaseError is null ? "." : $" ({databaseError}).")}" },
                    new { key = "authentication", name = "Autentisering", status = "healthy", detail = "Sesjon og tilgangskontroll er aktiv." }
                },
                unavailableSignals = new[] { "Diskplass", "Siste backup", "Containerstatus og omstarter" }
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
}
