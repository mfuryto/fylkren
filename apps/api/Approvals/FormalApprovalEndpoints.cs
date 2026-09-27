using System.Security.Claims;
using System.Text.Json;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.Approvals;

public static class FormalApprovalEndpoints
{
    public static IEndpointRouteBuilder MapFormalApprovalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/approvals/sites/{siteId:guid}/items/{itemId:guid}/versions", GetVersions).RequireAuthorization();
        return endpoints;
    }

    private static async Task<IResult> GetVersions(Guid siteId, Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var item = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
        if (item is null) return Results.NotFound();
        if (!await CanReadWorkTree(siteId, itemId, personId, db, ct) && !await LeadsSiteRoot(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
        var versions = await db.DomainObjectVersions.AsNoTracking().Where(x => x.SiteId == siteId && x.ContextWorkItemId == itemId)
            .Include(x => x.Signoffs).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Results.Ok(versions.Select(x => new
        {
            x.Id, x.ObjectType, x.ObjectId, x.VersionNumber, x.Title, x.ApprovalStatus, x.CreatedAt, x.ContentHash,
            content = JsonSerializer.Deserialize<JsonElement>(x.ContentJson),
            signoffs = x.Signoffs.OrderBy(s => s.SignedAt).Select(s => new { s.Id, s.ApproverPersonId, approver = s.ApproverNameSnapshot, s.Status, s.SignedAt, s.Comment })
        }));
    }
}
