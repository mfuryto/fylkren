using System.Text.RegularExpressions;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static partial class BrandingEndpoints
{
    private static readonly Guid SettingsId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    public static IEndpointRouteBuilder MapBrandingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/branding", async (FylkrenDbContext db, CancellationToken ct) =>
        {
            var value = await db.BrandingSettings.AsNoTracking().SingleAsync(x => x.Id == SettingsId, ct);
            return Results.Ok(new { value.ProductName, value.InstanceName, value.Theme, value.PrimaryColor, value.AccentColor, value.TopBarColor, value.TopBarTextColor, value.CustomCss, hasLogo = value.Logo != null });
        }).AllowAnonymous();
        var admin = endpoints.MapGroup("/api/platform/branding").RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        admin.MapPut("/", async (UpdateBranding request, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var name = (request.ProductName ?? "").Trim();
            var instanceName = (request.InstanceName ?? "").Trim();
            var theme = request.Theme ?? ""; var primaryColor = request.PrimaryColor ?? ""; var accentColor = request.AccentColor ?? ""; var topBarColor = request.TopBarColor ?? ""; var topBarTextColor = request.TopBarTextColor ?? "";
            var customCss = request.CustomCss ?? "";
            if (name.Length is < 2 or > 80 || instanceName.Length is < 2 or > 80 || theme is not ("light" or "dark" or "system") || !HexColor().IsMatch(primaryColor) || !HexColor().IsMatch(accentColor) || !HexColor().IsMatch(topBarColor) || !HexColor().IsMatch(topBarTextColor)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["branding"] = ["Kontroller produktnavn, installasjonsnavn, tema og farger."] });
            if (customCss.Length > 20_000 || UnsafeCss().IsMatch(customCss)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["customCss"] = ["CSS kan være maksimalt 20 000 tegn og kan ikke hente eksterne ressurser med url() eller @import."] });
            var value = await db.BrandingSettings.SingleAsync(x => x.Id == SettingsId, ct); value.Update(name, instanceName, theme, primaryColor.ToLowerInvariant(), accentColor.ToLowerInvariant(), topBarColor.ToLowerInvariant(), topBarTextColor.ToLowerInvariant(), customCss); Record(db, context, "branding.updated"); await db.SaveChangesAsync(ct); return Results.NoContent();
        });
        admin.MapPut("/logo", async (IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(); var form = await context.Request.ReadFormAsync(ct); var logo = form.Files.GetFile("logo");
            var validatedLogo = await SafeImageUpload.ReadAsync(logo, ct);
            if (validatedLogo is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["logo"] = ["Bruk et gyldig PNG-, JPEG- eller WebP-bilde på maksimalt 2 MB. Filinnholdet må samsvare med filtypen."] });
            var value = await db.BrandingSettings.SingleAsync(x => x.Id == SettingsId, ct); value.SetLogo(validatedLogo.Bytes, validatedLogo.ContentType); Record(db, context, "branding.logo-updated"); await db.SaveChangesAsync(ct); return Results.NoContent();
        });
        admin.MapDelete("/logo", async (IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) => { if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(); var value = await db.BrandingSettings.SingleAsync(x => x.Id == SettingsId, ct); value.SetLogo(null, null); Record(db, context, "branding.logo-removed"); await db.SaveChangesAsync(ct); return Results.NoContent(); });
        endpoints.MapGet("/api/branding/logo", async (HttpContext context, FylkrenDbContext db, CancellationToken ct) => { context.Response.Headers.CacheControl = "no-store"; var value = await db.BrandingSettings.AsNoTracking().SingleAsync(x => x.Id == SettingsId, ct); return value.Logo is null ? Results.NotFound() : Results.File(value.Logo, value.LogoContentType ?? "application/octet-stream"); }).AllowAnonymous();
        return endpoints;
    }
    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();
    [GeneratedRegex("(@import|url\\s*\\(|expression\\s*\\(|javascript\\s*:|</?style)", RegexOptions.IgnoreCase)]
    private static partial Regex UnsafeCss();
    private static void Record(FylkrenDbContext db, HttpContext context, string eventType) { if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor)) db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, eventType, "branding-settings", SettingsId, DateTimeOffset.UtcNow)); }
    private sealed record UpdateBranding(string? ProductName, string? InstanceName, string? Theme, string? PrimaryColor, string? AccentColor, string? TopBarColor, string? TopBarTextColor, string? CustomCss);
}
