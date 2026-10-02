using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class ReportQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/reports", async (Guid siteId, Guid? unitId, int? year, string? search, string? sort, int? page, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!PersonId(user, out var personId) || !await CanReadReportsAtLevel(siteId, unitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, search) is { } queryError) return queryError;
            if (year is < 1900 or > 9999) return Results.ValidationProblem(new Dictionary<string, string[]> { ["year"] = ["The year must be between 1900 and 9999."] });
            var pageNumber = Math.Max(page ?? 1, 1); const int pageSize = 20;
            var query = db.WorkItems.AsNoTracking().Where(x => x.SiteId == siteId && x.AssignedUnitId == unitId && x.Status == "completed" && x.FinalReport != null && x.FinalReportApprovedAt != null);
            var years = await query.Select(x => x.FinalReportApprovedAt!.Value.Year).Distinct().OrderByDescending(x => x).ToListAsync(ct);
            if (year is > 0)
            {
                var from = new DateTimeOffset(year.Value, 1, 1, 0, 0, 0, TimeSpan.Zero);
                var until = from.AddYears(1);
                query = query.Where(x => x.FinalReportApprovedAt >= from && x.FinalReportApprovedAt < until);
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = RequestQueryPolicy.LikePattern(search);
                query = query.Where(x => EF.Functions.ILike(x.ReferenceCode, pattern, "\\") || EF.Functions.ILike(x.Title, pattern, "\\") || EF.Functions.ILike(x.FinalReport!, pattern, "\\") || x.CreatedByPerson != null && EF.Functions.ILike(x.CreatedByPerson.DisplayName, pattern, "\\") || x.SenderSiteName != null && EF.Functions.ILike(x.SenderSiteName, pattern, "\\") || x.FinalReportWrittenByPerson != null && EF.Functions.ILike(x.FinalReportWrittenByPerson.DisplayName, pattern, "\\"));
            }
            var total = await query.CountAsync(ct);
            var siteName = await db.Sites.Where(x => x.Id == siteId).Select(x => x.Name).SingleAsync(ct);
            var organizationUnits = await OrganizationPath.Load(siteId, db, ct);
            var organizationPath = OrganizationPath.Build(unitId, organizationUnits);
            var orderedReports = sort switch
            {
                "oldest" => query.OrderBy(x => x.FinalReportApprovedAt).ThenBy(x => x.Id),
                "name-asc" => query.OrderBy(x => x.Title).ThenBy(x => x.Id),
                "name-desc" => query.OrderByDescending(x => x.Title).ThenBy(x => x.Id),
                "reference-asc" => query.OrderBy(x => x.ReferenceCode).ThenBy(x => x.Id),
                "reference-desc" => query.OrderByDescending(x => x.ReferenceCode).ThenBy(x => x.Id),
                _ => query.OrderByDescending(x => x.FinalReportApprovedAt).ThenBy(x => x.Id),
            };
            var rows = await orderedReports
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.Id,
                    x.ReferenceCode,
                    x.OriginReference,
                    x.Title,
                    federatedAnswerSiteName = db.FederationWorkLinks
                        .Where(link => link.Direction == "outgoing" &&
                            link.LocalWorkItemId == x.Id && link.OfficialAnswerMessageId != null)
                        .Select(link => link.OfficialAnswerSiteName)
                        .FirstOrDefault(),
                    isOutgoingRequest = db.WorkItems.Any(child =>
                        child.ParentWorkItemId == x.Id &&
                        child.SenderSiteName != null &&
                        (child.SiteId != x.SiteId || child.AssignedUnitId != x.AssignedUnitId)),
                    response = db.WorkItems
                        .Where(child =>
                            child.ParentWorkItemId == x.Id &&
                            child.SenderSiteName != null &&
                            (child.SiteId != x.SiteId || child.AssignedUnitId != x.AssignedUnitId) &&
                            child.Status == "completed")
                        .Select(child => new
                        {
                            SiteName = child.Site.Name,
                            child.SiteId,
                            UnitId = child.AssignedUnitId
                        })
                        .FirstOrDefault(),
                    x.FinalReport,
                    x.FinalReportClassification,
                    reportCreatedAt = x.FinalReportCreatedAt ?? x.FinalReportUpdatedAt,
                    workReceivedAt = x.CreatedAt,
                    workCompletedAt = x.FinalReportUpdatedAt,
                    writtenBy = x.FinalReportWrittenByPerson == null
                        ? x.CreatedByPerson == null ? x.SenderSiteName ?? "External site" : x.CreatedByPerson.DisplayName
                        : x.FinalReportWrittenByPerson.DisplayName,
                    approvedBy = x.FinalReportApprovedByPerson == null
                        ? null
                        : x.FinalReportApprovedByPerson.DisplayName,
                    x.FinalReportApprovedAt
                })
                .ToListAsync(ct);
            var hierarchy = await WorkItemAncestryLoader.Load(siteId, rows.Select(x => (Guid?)x.Id), db, ct);
            string RootTitle(Guid id) { var current = id; var visited = new HashSet<Guid>(); while (visited.Add(current) && hierarchy.TryGetValue(current, out var node) && node.ParentWorkItemId is Guid parentId && hierarchy.ContainsKey(parentId)) current = parentId; return hierarchy.TryGetValue(current, out var root) ? root.Title : string.Empty; }
            var reports = rows.Select(x => new
            {
                x.Id,
                x.ReferenceCode,
                x.OriginReference,
                siteName = x.federatedAnswerSiteName ??
                    (x.isOutgoingRequest ? x.response?.SiteName ?? siteName : siteName),
                organizationPath = x.isOutgoingRequest
                    ? x.response?.SiteId == siteId
                        ? OrganizationPath.Build(x.response.UnitId, organizationUnits)
                        : []
                    : organizationPath,
                title = x.isOutgoingRequest ? x.Title : RootTitle(x.Id),
                x.FinalReport,
                x.FinalReportClassification,
                x.reportCreatedAt,
                x.workReceivedAt,
                x.workCompletedAt,
                writtenBy = x.federatedAnswerSiteName ?? x.writtenBy,
                x.approvedBy,
                x.FinalReportApprovedAt
            }).ToList();
            return Results.Ok(new { reports, years, page = pageNumber, pageSize, total, totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)) });
        });
    }

}
