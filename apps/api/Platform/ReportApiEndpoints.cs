using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class ReportApiEndpoints
{
    public static IEndpointRouteBuilder MapReportApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapReportApiManagementEndpoints();
        var api = endpoints.MapGroup("/api/v1/reports").RequireAuthorization("MachineApi").RequireFeature(FeatureCatalog.MachineApi);
        api.MapGet("", ListReports)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "reports:read"))
            .RequireRateLimiting("administration-api");
        api.MapGet("/{reportId:guid}", GetReport)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "reports:read"))
            .RequireRateLimiting("administration-api");
        return endpoints;
    }

    private static async Task<IResult> ListReports(
        Guid siteId, Guid? unitId, int? year, string? search, int? page, int? pageSize,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!TryGetMachineId(context.User, out var machineId)) return Results.Unauthorized();
        if (RequestQueryPolicy.Validate(page, search, pageSize) is { } queryError) return queryError;
        if (year is < 1900 or > 9999)
            return Validation("year", "The year must be between 1900 and 9999.");
        var grant = await FindGrant(machineId, siteId, unitId, db, ct);
        if (grant is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "The API client does not have report access to this work level.");
        }

        var query = db.WorkItems.AsNoTracking().Where(item =>
            item.SiteId == siteId && item.AssignedUnitId == unitId &&
            item.Status == "completed" && item.FinalReport != null && item.FinalReportApprovedAt != null &&
            (item.FinalReportClassification == null || grant.IncludeClassified));
        if (year is > 0) query = query.Where(item => item.FinalReportApprovedAt!.Value.Year == year);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = RequestQueryPolicy.LikePattern(search);
            query = query.Where(item =>
                EF.Functions.ILike(item.ReferenceCode, pattern, "\\") ||
                item.OriginReference != null && EF.Functions.ILike(item.OriginReference, pattern, "\\") ||
                EF.Functions.ILike(item.Title, pattern, "\\") ||
                EF.Functions.ILike(item.FinalReport!, pattern, "\\"));
        }

        var pageNumber = Math.Max(page ?? 1, 1);
        var effectivePageSize = Math.Clamp(pageSize ?? 50, 1, 100);
        var total = await query.LongCountAsync(ct);
        var rows = await query
            .OrderByDescending(item => item.FinalReportApprovedAt)
            .ThenBy(item => item.Id)
            .Skip((pageNumber - 1) * effectivePageSize)
            .Take(effectivePageSize)
            .Select(item => new
            {
                item.Id,
                item.ReferenceCode,
                item.OriginReference,
                item.Title,
                item.FinalReportClassification,
                ReportCreatedAt = item.FinalReportCreatedAt ?? item.FinalReportUpdatedAt,
                WorkReceivedAt = item.CreatedAt,
                WorkCompletedAt = item.FinalReportUpdatedAt,
                WrittenBy = item.FinalReportWrittenByPerson == null ? item.CreatedByPerson == null ? item.SenderSiteName ?? "External site" : item.CreatedByPerson.DisplayName : item.FinalReportWrittenByPerson.DisplayName,
                ApprovedBy = item.FinalReportApprovedByPerson == null ? null : item.FinalReportApprovedByPerson.DisplayName,
                item.FinalReportApprovedAt
            })
            .ToListAsync(ct);
        var siteName = await db.Sites.Where(site => site.Id == siteId).Select(site => site.Name).SingleAsync(ct);
        var organizationUnits = await OrganizationPath.Load(siteId, db, ct);
        var organizationPath = OrganizationPath.Build(unitId, organizationUnits);
        var items = rows.Select(row => new
        {
            row.Id,
            row.ReferenceCode,
            row.OriginReference,
            row.Title,
            siteId,
            siteName,
            organizationUnitId = unitId,
            organizationPath,
            row.FinalReportClassification,
            reportCreatedAt = row.ReportCreatedAt,
            workReceivedAt = row.WorkReceivedAt,
            workCompletedAt = row.WorkCompletedAt,
            writtenBy = row.WrittenBy,
            approvedBy = row.ApprovedBy,
            row.FinalReportApprovedAt
        });
        db.ApiMachineAuditEvents.Add(new ApiMachineAuditEvent(
            Guid.NewGuid(), machineId, siteId, "report.listed", "api-report-grant", grant.Id,
            context.TraceIdentifier, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.Ok(new
        {
            items,
            page = pageNumber,
            pageSize = effectivePageSize,
            total,
            totalPages = Math.Max(1L, NumericBounds.Pages(total, effectivePageSize))
        });
    }

    private static async Task<IResult> GetReport(
        Guid reportId, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!TryGetMachineId(context.User, out var machineId)) return Results.Unauthorized();
        var row = await db.WorkItems.AsNoTracking()
            .Where(item => item.Id == reportId && item.Status == "completed" &&
                           item.FinalReport != null && item.FinalReportApprovedAt != null)
            .Select(item => new
            {
                item.Id,
                item.SiteId,
                item.AssignedUnitId,
                item.ReferenceCode,
                item.OriginReference,
                item.Title,
                item.FinalReport,
                item.FinalReportClassification,
                SiteName = item.Site.Name,
                ReportCreatedAt = item.FinalReportCreatedAt ?? item.FinalReportUpdatedAt,
                WorkReceivedAt = item.CreatedAt,
                WorkCompletedAt = item.FinalReportUpdatedAt,
                WrittenBy = item.FinalReportWrittenByPerson == null ? item.CreatedByPerson == null ? item.SenderSiteName ?? "External site" : item.CreatedByPerson.DisplayName : item.FinalReportWrittenByPerson.DisplayName,
                ApprovedBy = item.FinalReportApprovedByPerson == null ? null : item.FinalReportApprovedByPerson.DisplayName,
                item.FinalReportApprovedAt
            })
            .SingleOrDefaultAsync(ct);
        if (row is null) return Results.NotFound();

        var grant = await FindGrant(machineId, row.SiteId, row.AssignedUnitId, db, ct);
        if (grant is null || row.FinalReportClassification != null && !grant.IncludeClassified) return Results.NotFound();

        var organizationUnits = await OrganizationPath.Load(row.SiteId, db, ct);
        var organizationPath = OrganizationPath.Build(row.AssignedUnitId, organizationUnits);
        db.ApiMachineAuditEvents.Add(new ApiMachineAuditEvent(
            Guid.NewGuid(), machineId, row.SiteId, "report.read", "report", row.Id,
            context.TraceIdentifier, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.Ok(new
        {
            row.Id,
            row.SiteId,
            organizationUnitId = row.AssignedUnitId,
            row.ReferenceCode,
            row.OriginReference,
            row.Title,
            row.FinalReport,
            row.FinalReportClassification,
            siteName = row.SiteName,
            organizationPath,
            reportCreatedAt = row.ReportCreatedAt,
            workReceivedAt = row.WorkReceivedAt,
            workCompletedAt = row.WorkCompletedAt,
            writtenBy = row.WrittenBy,
            approvedBy = row.ApprovedBy,
            row.FinalReportApprovedAt
        });
    }

    private static async Task<ApiReportGrant?> FindGrant(
        Guid machineId, Guid siteId, Guid? unitId, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await db.Sites.AsNoTracking().AnyAsync(site => site.Id == siteId && site.IsActive, ct))
            return null;
        return await db.ApiReportGrants.AsNoTracking().SingleOrDefaultAsync(grant =>
            grant.MachineIdentityId == machineId && grant.SiteId == siteId &&
            grant.OrganizationUnitId == unitId, ct);
    }

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static bool TryGetMachineId(ClaimsPrincipal user, out Guid machineId) =>
        Guid.TryParse(user.FindFirstValue("fylkren:machine_id"), out machineId);
}
