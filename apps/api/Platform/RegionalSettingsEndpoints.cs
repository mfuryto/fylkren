using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class RegionalSettingsEndpoints
{
    public static IEndpointRouteBuilder MapRegionalSettingsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var admin = endpoints.MapGroup("/api/platform/regional-settings")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        admin.MapGet("/", async (FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            var value = await database.RegionalSettings.AsNoTracking()
                .SingleAsync(item => item.Id == DatabaseDefaults.RegionalSettingsId, cancellationToken);
            return Results.Ok(Response(value));
        });

        admin.MapPut("/", async (UpdateRegionalSettings request, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();

            var language = RegionalSettings.NormalizeLanguage(request.DefaultLanguage);
            if (!string.Equals(request.DefaultLanguage?.Trim(), language, StringComparison.OrdinalIgnoreCase) &&
                !new[] { "en", "nb", "no", "no-NO" }.Contains(request.DefaultLanguage?.Trim(), StringComparer.OrdinalIgnoreCase))
                return Validation("defaultLanguage", "Choose a supported language.");

            var timeZone = (request.TimeZone ?? "").Trim();
            try { _ = TimeZoneInfo.FindSystemTimeZoneById(timeZone); }
            catch (TimeZoneNotFoundException) { return Validation("timeZone", "Choose a valid IANA time zone."); }
            catch (InvalidTimeZoneException) { return Validation("timeZone", "Choose a valid IANA time zone."); }

            var clockFormat = (request.ClockFormat ?? "").Trim();
            if (clockFormat is not ("12-hour" or "24-hour"))
                return Validation("clockFormat", "Choose a 12-hour or 24-hour clock.");

            var measurementSystem = (request.MeasurementSystem ?? "").Trim();
            if (measurementSystem is not ("metric" or "imperial"))
                return Validation("measurementSystem", "Choose metric or imperial units.");

            var value = await database.RegionalSettings
                .SingleAsync(item => item.Id == DatabaseDefaults.RegionalSettingsId, cancellationToken);
            value.Update(language, timeZone, clockFormat, measurementSystem);
            if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
                database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor,
                    "regional-settings.updated", "regional-settings", value.Id, DateTimeOffset.UtcNow));
            await database.SaveChangesAsync(cancellationToken);
            return Results.Ok(Response(value));
        });

        return endpoints;
    }

    private static object Response(RegionalSettings value) => new
    {
        value.DefaultLanguage,
        value.TimeZone,
        value.ClockFormat,
        value.MeasurementSystem
    };

    private static IResult Validation(string key, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [key] = [message] });

    private sealed record UpdateRegionalSettings(
        string? DefaultLanguage,
        string? TimeZone,
        string? ClockFormat,
        string? MeasurementSystem);
}
