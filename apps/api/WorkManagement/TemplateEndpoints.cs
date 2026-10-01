using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

public static class TemplateEndpoints
{
    private const string DefaultFinalReportTemplate = "# Summary\n\n# Execution\n\n# Conclusion";

    public static IEndpointRouteBuilder MapTemplateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/templates").RequireAuthorization();
        group.MapGet("/sites/{siteId:guid}", List);
        group.MapPost("/sites/{siteId:guid}", Create);
        group.MapPut("/{id:guid}", Update);
        group.MapDelete("/{id:guid}", Delete);
        group.MapGet("/sites/{siteId:guid}/final-report", GetFinalReportTemplate);
        group.MapPut("/sites/{siteId:guid}/final-report", UpdateFinalReportTemplate);
        return endpoints;
    }

    private static bool PersonId(ClaimsPrincipal user, out Guid personId) => Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out personId);
    private static async Task<IResult> List(Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId)) return Results.Forbid();
        var siteAdministrator = await IsSiteManager(siteId, personId, db, ct);
        if (!siteAdministrator) return Results.Forbid();
        var templates = await db.WorkflowStepTemplates.AsNoTracking()
            .Where(x => x.SiteId == siteId && x.IsActive)
            .OrderBy(x => x.OwnerUnitId == null ? 0 : 1).ThenBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Content,
                x.OwnerUnitId,
                ownerUnitName = x.OwnerUnit == null ? null : x.OwnerUnit.Name,
                canEdit = true
            })
            .ToListAsync(ct);
        return Results.Ok(templates);
    }

    private static bool Valid(Request request) => (request.Name ?? "").Trim().Length is >= 2 and <= 150 && (request.Content ?? "").Trim().Length <= 20000;

    private static async Task<IResult> GetFinalReportTemplate(Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId)) return Results.Forbid();
        var canEdit = await IsSiteManager(siteId, personId, db, ct);
        if (!canEdit && !await WorkLevelAuthorization.IsSiteMember(siteId, personId, db, ct)) return Results.Forbid();
        var content = await db.Sites.AsNoTracking().Where(x => x.Id == siteId && x.IsActive).Select(x => x.FinalReportTemplate).SingleOrDefaultAsync(ct);
        return Results.Ok(new { content = FinalReportTemplateContent(content), canEdit });
    }

    private static async Task<IResult> UpdateFinalReportTemplate(Guid siteId, FinalReportTemplateRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) || !await IsSiteManager(siteId, personId, db, ct)) return Results.Forbid();
        var content = request.Content?.Trim();
        if (content?.Length > 20000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["content"] = ["The final report template can contain at most 20,000 characters."] });
        var site = await db.Sites.SingleOrDefaultAsync(x => x.Id == siteId && x.IsActive, ct);
        if (site is null) return Results.NotFound();
        site.UpdateFinalReportTemplate(content);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "final-report-template.updated", "site", siteId, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Create(Guid siteId, Request request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) || !await CanOwn(siteId, request.OwnerUnitId, personId, db, ct)) return Results.Forbid();
        if (!Valid(request)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["template"] = ["Check the name and content."] });
        if (await db.WorkflowStepTemplates.AnyAsync(x => x.SiteId == siteId && x.OwnerUnitId == request.OwnerUnitId && x.IsActive && x.Name.ToLower() == request.Name.Trim().ToLower(), ct)) return Results.Conflict(new { error = "An active template with the same name already exists at this level." });
        var template = new WorkflowStepTemplate(Guid.NewGuid(), siteId, request.OwnerUnitId, request.Name, request.Content, DateTimeOffset.UtcNow);
        db.Add(template);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
            "workflow-template.created", "workflow-template", template.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct); return Results.Created($"/api/templates/{template.Id}", new { template.Id });
    }

    private static async Task<IResult> Update(Guid id, Request request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var template = await db.WorkflowStepTemplates.SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct);
        if (template is null) return Results.NotFound();
        if (!PersonId(user, out var personId) || request.OwnerUnitId != template.OwnerUnitId || !await CanOwn(template.SiteId, template.OwnerUnitId, personId, db, ct)) return Results.Forbid();
        if (!Valid(request)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["template"] = ["Check the name and content."] });
        if (await db.WorkflowStepTemplates.AnyAsync(x => x.SiteId == template.SiteId && x.OwnerUnitId == template.OwnerUnitId && x.IsActive && x.Id != id && x.Name.ToLower() == request.Name.Trim().ToLower(), ct)) return Results.Conflict(new { error = "An active template with the same name already exists at this level." });
        template.Update(request.Name, request.Content);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), template.SiteId, personId,
            "workflow-template.updated", "workflow-template", template.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct); return Results.NoContent();
    }

    private static async Task<IResult> Delete(Guid id, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var template = await db.WorkflowStepTemplates.SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct);
        if (template is null) return Results.NotFound();
        if (!PersonId(user, out var personId) || !await CanOwn(template.SiteId, template.OwnerUnitId, personId, db, ct)) return Results.Forbid();
        template.Deactivate();
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), template.SiteId, personId,
            "workflow-template.deactivated", "workflow-template", template.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct); return Results.NoContent();
    }

    private static Task<bool> CanOwn(Guid siteId, Guid? ownerUnitId, Guid personId, FylkrenDbContext db, CancellationToken ct) => IsSiteManager(siteId, personId, db, ct);
    private static Task<bool> IsSiteManager(Guid siteId, Guid personId, FylkrenDbContext db, CancellationToken ct) => db.SiteManagerAssignments.AnyAsync(x => x.SiteId == siteId && x.PersonId == personId && x.IsActive && x.Site.IsActive, ct);

    private static string FinalReportTemplateContent(string? content) =>
        string.IsNullOrWhiteSpace(content)
            ? DefaultFinalReportTemplate
            : content;

    private sealed record Request(string Name, string Content, Guid? OwnerUnitId);
    private sealed record FinalReportTemplateRequest(string? Content);
}
