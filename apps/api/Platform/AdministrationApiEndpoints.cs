using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.Organization;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using static Fylkren.Api.Platform.AdministrationApiSupport;

namespace Fylkren.Api.Platform;

public static class AdministrationApiEndpoints
{
    private static readonly HashSet<string> OverviewDesigns = ["classic", "minimal"];

    public static IEndpointRouteBuilder MapAdministrationApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        AdministrationClientEndpoints.Map(endpoints);
        var api = endpoints.MapGroup("/api/v1/administration").RequireAuthorization("MachineApi").RequireFeature(FeatureCatalog.MachineApi);
        api.MapGet("/sites", ListSites)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:read"))
            .RequireRateLimiting("administration-api");
        api.MapGet("/sites/{siteId:guid}", GetSite)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:read"))
            .RequireRateLimiting("administration-api");
        api.MapGet("/site-placement-options", ListSitePlacementOptions)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:read"))
            .RequireRateLimiting("administration-api");
        api.MapPost("/sites", CreateSite)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:write"))
            .RequireRateLimiting("administration-api-write");
        api.MapPut("/sites/{siteId:guid}", UpdateSite)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:write"))
            .RequireRateLimiting("administration-api-write");
        api.MapPost("/sites/{siteId:guid}/move", MoveSite)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:move"))
            .RequireRateLimiting("administration-api-write");
        api.MapPost("/sites/{siteId:guid}/deactivate", DeactivateSite)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "sites:deactivate"))
            .RequireRateLimiting("administration-api-write");
        AdministrationUserEndpoints.Map(api);
        AdministrationClassificationEndpoints.Map(api);
        return endpoints;
    }

    private static async Task<IResult> ListSites(
        int? limit, string? search, FylkrenDbContext db, CancellationToken ct)
    {
        if (RequestQueryPolicy.Validate(null, search) is { } queryError)
        {
            return queryError;
        }

        var take = Math.Clamp(limit ?? 50, 1, 100);
        var query = db.Sites.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = RequestQueryPolicy.LikePattern(search);
            query = query.Where(x => EF.Functions.ILike(x.Name, pattern, "\\"));
        }

        var items = await query.OrderBy(x => x.Name).ThenBy(x => x.Id)
            .Take(take).Select(SiteProjection()).ToListAsync(ct);
        return Results.Ok(new { items });
    }

    private static async Task<IResult> GetSite(
        Guid siteId, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().Where(x => x.Id == siteId)
            .Select(SiteProjection()).SingleOrDefaultAsync(ct);
        if (site is null)
        {
            return Results.NotFound();
        }

        context.Response.Headers.ETag = ETag(site.Version);
        return Results.Ok(site);
    }

    private static async Task<IResult> ListSitePlacementOptions(
        FylkrenDbContext db, CancellationToken ct)
    {
        var items = await db.OrganizationUnits.AsNoTracking()
            .Where(x => x.IsActive && x.Site.IsActive)
            .OrderBy(x => x.Site.Name)
            .ThenBy(x => x.IsSiteRoot ? 0 : 1)
            .ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.SiteId, SiteName = x.Site.Name, x.Name, x.IsSiteRoot })
            .ToListAsync(ct);
        return Results.Ok(new { items });
    }

    private static async Task<IResult> CreateSite(CreateSiteRequest request, HttpContext context, FylkrenDbContext db, LicenseService license, CancellationToken ct)
    {
        if (!MachineId(context.User, out var machineId))
        {
            return Results.Unauthorized();
        }

        var key = context.Request.Headers["Idempotency-Key"].ToString().Trim();
        if (!ValidIdempotencyKey(key))
        {
            return Problem(context, 400, "invalid_idempotency_key",
                "Idempotency-Key må bestå av 8–128 tillatte tegn.");
        }

        var name = request.Name?.Trim() ?? "";
        var design = request.OverviewDesign?.Trim() ?? "classic";
        if (ValidateSiteInput(name, design) is { } validationError)
        {
            return validationError;
        }

        var requestHash = RequestHash(name, design);
        var previous = await FindIdempotencyRecord(db, machineId, key, ct);
        if (previous is not null)
        {
            return await IdempotentResult(previous, requestHash, context, db, ct);
        }

        var normalizedName = name.ToUpperInvariant();
        if (await db.Sites.AnyAsync(x => x.NormalizedName == normalizedName, ct))
        {
            return Problem(context, 409, "site_name_conflict", "En site med dette navnet finnes allerede.");
        }

        await using var capacity = await SiteCapacityPolicy.BeginAdditionAsync(db, license, ct);
        if (capacity is null)
            return Problem(context, 409, "community_site_limit", SiteCapacityPolicy.LimitMessage);

        var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), name, now);
        site.UpdateOverviewDesign(design);
        db.Sites.Add(site);
        db.OrganizationUnits.Add(new OrganizationUnit(
            Guid.NewGuid(), site.Id, null, site.Name, false, now, true));
        DefaultSiteWorkConfiguration.Add(db, site.Id, now);
        db.ApiIdempotencyRecords.Add(new ApiIdempotencyRecord(
            Guid.NewGuid(), machineId, key, requestHash, site.Id, now));
        AddMachineAudit(db, machineId, site.Id, "site.created", site.Id, context, now);

        try
        {
            await db.SaveChangesAsync(ct);
            await capacity.CommitAsync(ct);
        }
        catch (DbUpdateException exception)
        {
            await capacity.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            previous = await FindIdempotencyRecord(db, machineId, key, ct);
            if (previous is not null)
            {
                return await IdempotentResult(previous, requestHash, context, db, ct);
            }

            if (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                return Problem(context, 409, "site_name_conflict", "En site med dette navnet finnes allerede.");
            }

            throw;
        }

        context.Response.Headers.ETag = ETag(site.Version);
        return Results.Created($"/api/v1/administration/sites/{site.Id}", ToResponse(site, null));
    }

    private static async Task<IResult> UpdateSite(Guid siteId, UpdateSiteRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadWritableSite(siteId, context, db, ct);
        if (access.Error is not null) return access.Error;
        var (machineId, site) = (access.MachineId, access.Site!);

        var name = request.Name?.Trim() ?? "";
        var design = request.OverviewDesign?.Trim() ?? "";
        if (ValidateSiteInput(name, design) is { } validationError) return validationError;
        if (await db.Sites.AnyAsync(
            x => x.Id != siteId && x.NormalizedName == name.ToUpperInvariant(), ct))
        {
            return Problem(context, 409, "site_name_conflict", "En site med dette navnet finnes allerede.");
        }

        var nameChanged = site.Name != name;
        site.Update(name, site.ParentOrganizationUnitId, site.IsActive);
        if (nameChanged && site.ParentOrganizationUnitId is null && site.IsActive)
            await Fylkren.Api.Federation.FederationSitePublicationPolicy.RefreshAsync(siteId, db, DateTimeOffset.UtcNow, ct);
        site.UpdateOverviewDesign(design);
        AddMachineAudit(db, machineId, site.Id, "site.updated", site.Id, context, DateTimeOffset.UtcNow);
        return await SaveVersioned(site, context, db, ct);
    }

    private static async Task<IResult> MoveSite(Guid siteId, MoveSiteRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadWritableSite(siteId, context, db, ct);
        if (access.Error is not null) return access.Error;
        var (machineId, site) = (access.MachineId, access.Site!);

        Guid? parentSiteId = null;
        if (request.ParentOrganizationUnitId is Guid placementId)
        {
            var placement = await db.OrganizationUnits
                .Where(x => x.Id == placementId && x.IsActive && x.Site.IsActive)
                .Select(x => new { x.SiteId }).SingleOrDefaultAsync(ct);
            if (placement is null)
                return Validation("parentOrganizationUnitId", "Festepunktet finnes ikke eller er deaktivert.");
            if (placement.SiteId == siteId)
                return Validation("parentOrganizationUnitId", "En site kan ikke plasseres i sin egen organisasjon.");
            parentSiteId = placement.SiteId;
        }

        var parents = await db.Sites.AsNoTracking()
            .Select(x => new { x.Id, ParentSiteId = x.ParentOrganizationUnit == null ? (Guid?)null : x.ParentOrganizationUnit.SiteId })
            .ToDictionaryAsync(x => x.Id, x => x.ParentSiteId, ct);
        for (var cursor = parentSiteId; cursor is Guid current; cursor = parents.GetValueOrDefault(current))
        {
            if (current == siteId)
                return Validation("parentOrganizationUnitId", "Flyttingen ville opprettet en sirkel i site-hierarkiet.");
        }

        site.Update(site.Name, request.ParentOrganizationUnitId, site.IsActive);
        if (request.ParentOrganizationUnitId is not null)
            await Fylkren.Api.Federation.FederationSitePublicationPolicy.SuspendAsync(siteId, db, DateTimeOffset.UtcNow, ct);
        AddMachineAudit(db, machineId, site.Id, "site.moved", site.Id, context, DateTimeOffset.UtcNow);
        return await SaveVersioned(site, context, db, ct);
    }

    private static async Task<IResult> DeactivateSite(Guid siteId, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadWritableSite(siteId, context, db, ct);
        if (access.Error is not null) return access.Error;
        var (machineId, site) = (access.MachineId, access.Site!);
        if (!site.IsActive)
            return Problem(context, 409, "site_already_inactive", "Siten er allerede deaktivert.");
        if (await SiteDeactivationService.HasActiveChildrenAsync(siteId, db, ct))
        {
            return Problem(context, 409, "active_child_sites",
                "Siten har aktive underlagte sites og må tømmes før den kan deaktiveres.");
        }

        var now = DateTimeOffset.UtcNow;
        await SiteDeactivationService.DeactivateAsync(site, db, now, ct);
        AddMachineAudit(db, machineId, site.Id, "site.deactivated", site.Id, context, now);
        return await SaveVersioned(site, context, db, ct, true);
    }

    private static async Task<IResult> SaveVersioned(Site site, HttpContext context, FylkrenDbContext db, CancellationToken ct, bool noContent = false)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(context, 409, "version_conflict",
                "Siten er endret av en annen klient. Les den på nytt og prøv igjen.");
        }

        context.Response.Headers.ETag = ETag(site.Version);
        if (noContent) return Results.NoContent();
        var parentSiteId = site.ParentOrganizationUnitId is null
            ? null
            : await db.OrganizationUnits.Where(x => x.Id == site.ParentOrganizationUnitId)
                .Select(x => (Guid?)x.SiteId).SingleOrDefaultAsync(ct);
        return Results.Ok(ToResponse(site, parentSiteId));
    }

    private static async Task<IResult> IdempotentResult(
        ApiIdempotencyRecord record, string hash, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (record.RequestHash != hash)
            return Problem(context, 409, "idempotency_key_reused",
                "Idempotency-Key er allerede brukt med et annet innhold.");
        var site = await db.Sites.AsNoTracking().Where(x => x.Id == record.ResourceId)
            .Select(SiteProjection()).SingleAsync(ct);
        context.Response.Headers.ETag = ETag(site.Version);
        context.Response.Headers.Location = $"/api/v1/administration/sites/{site.Id}";
        return Results.Json(site, statusCode: StatusCodes.Status201Created);
    }

    private static Task<ApiIdempotencyRecord?> FindIdempotencyRecord(
        FylkrenDbContext db, Guid machineId, string key, CancellationToken ct) =>
        db.ApiIdempotencyRecords.AsNoTracking()
            .SingleOrDefaultAsync(x => x.MachineIdentityId == machineId && x.Key == key, ct);

    private static bool ValidIdempotencyKey(string key) =>
        key.Length is >= 8 and <= 128 &&
        key.All(character => char.IsAsciiLetterOrDigit(character) || "._:-".Contains(character));

    private static string RequestHash(string name, string design) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            name = name.ToUpperInvariant(),
            overviewDesign = design
        })))).ToLowerInvariant();

    private static IResult? ValidateSiteInput(string name, string design)
    {
        if (name.Length is < 2 or > 200)
            return Validation("name", "Navnet må være mellom 2 og 200 tegn.");
        return !OverviewDesigns.Contains(design)
            ? Validation("overviewDesign", "Velg en gyldig oversiktsprofil.")
            : null;
    }

    private static async Task<WritableSiteAccess> LoadWritableSite(
        Guid siteId, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!MachineId(context.User, out var machineId))
            return new(machineId, null, Results.Unauthorized());
        var site = await db.Sites.SingleOrDefaultAsync(x => x.Id == siteId, ct);
        if (site is null) return new(machineId, null, Results.NotFound());
        return !ExpectedVersion(context, site.Version, out var error)
            ? new(machineId, null, error)
            : new(machineId, site, null);
    }

    private static void AddMachineAudit(
        FylkrenDbContext db, Guid machineId, Guid? siteId, string eventType,
        Guid entityId, HttpContext context, DateTimeOffset now) =>
        db.ApiMachineAuditEvents.Add(new ApiMachineAuditEvent(
            Guid.NewGuid(), machineId, siteId, eventType, "site", entityId,
            context.TraceIdentifier, now));

    private static bool ExpectedVersion(HttpContext context, long current, out IResult? error)
    {
        var raw = context.Request.Headers.IfMatch.ToString().Trim();
        if (raw.Length < 3 || raw[0] != '"' || raw[^1] != '"' ||
            !long.TryParse(raw[1..^1], out var expected))
        {
            error = Problem(context, 428, "if_match_required",
                "Gyldig If-Match fra siste lesing er påkrevd.");
            return false;
        }

        if (expected != current)
        {
            error = Problem(context, 409, "version_conflict",
                "Siten er endret. Les den på nytt og prøv igjen.");
            return false;
        }

        error = null;
        return true;
    }
    private static string ETag(long version) => $"\"{version}\"";
    private static object ToResponse(Site x, Guid? parentSiteId) => new
    {
        x.Id,
        x.Name,
        x.IsActive,
        x.ParentOrganizationUnitId,
        ParentSiteId = parentSiteId,
        x.OverviewDesign,
        x.Version
    };
    private static System.Linq.Expressions.Expression<Func<Site, SiteReadResponse>> SiteProjection() =>
        site => new SiteReadResponse(
            site.Id, site.Name, site.IsActive, site.ParentOrganizationUnitId,
            site.ParentOrganizationUnit == null ? null : site.ParentOrganizationUnit.SiteId,
            site.OverviewDesign, site.Version);
    private sealed record WritableSiteAccess(Guid MachineId, Site? Site, IResult? Error);
    private sealed record CreateSiteRequest(string? Name, string? OverviewDesign);
    private sealed record UpdateSiteRequest(string? Name, string? OverviewDesign);
    private sealed record MoveSiteRequest(Guid? ParentOrganizationUnitId);
    private sealed record SiteReadResponse(Guid Id, string Name, bool IsActive, Guid? ParentOrganizationUnitId, Guid? ParentSiteId, string OverviewDesign, long Version);
}
