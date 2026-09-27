using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Portability;

public static class PortabilityEndpoints
{
    public static IEndpointRouteBuilder MapPortabilityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/portability").RequireAuthorization();
        group.MapPost("/sites/{siteId:guid}/export", Export);
        group.MapPost("/sites/{siteId:guid}/imports/validate", ValidateImport)
            .DisableAntiforgery()
            .WithMetadata(new RequestFormLimitsAttribute { MultipartBodyLengthLimit = PortableExportPackage.MaximumPackageBytes });
        return endpoints;
    }

    private static async Task<IResult> Export(
        Guid siteId,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext db,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!PersonId(user, out var actorPersonId) || !await CanAdminister(siteId, actorPersonId, user, db, cancellationToken))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
        if (!await db.Sites.AnyAsync(value => value.Id == siteId, cancellationToken)) return Results.NotFound();
        try
        {
            var content = await PortableExportPackage.Create(siteId, actorPersonId, db, cancellationToken);
            return Results.File(content, "application/zip", $"fylkren-site-{siteId:N}-export.zip");
        }
        catch (PortablePackageTooLargeException)
        {
            return Results.Problem(statusCode: StatusCodes.Status413PayloadTooLarge, title: "Eksportpakken overskrider grensen på 512 MiB.");
        }
    }

    private static async Task<IResult> ValidateImport(
        Guid siteId,
        HttpRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext db,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!PersonId(user, out var actorPersonId) || !await CanAdminister(siteId, actorPersonId, user, db, cancellationToken))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
        if (!request.HasFormContentType) return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["Last opp en Fylkren-eksportpakke."] });
        var form = await request.ReadFormAsync(cancellationToken);
        var file = form.Files.GetFile("package");
        if (file is null || file.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["Eksportpakken mangler eller er tom."] });
        if (file.Length > PortableExportPackage.MaximumPackageBytes) return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["Eksportpakken kan ikke være større enn 512 MiB."] });
        await using var stream = file.OpenReadStream();
        var result = await PortableImportValidator.Validate(stream, siteId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, result.Valid ? "portability.import-package-validated" : "portability.import-package-rejected", "portable-export", result.ExportId == Guid.Empty ? siteId : result.ExportId, now));
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(result);
    }

    private static bool PersonId(ClaimsPrincipal user, out Guid personId) =>
        Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out personId);

    private static async Task<bool> CanAdminister(
        Guid siteId,
        Guid personId,
        ClaimsPrincipal user,
        FylkrenDbContext db,
        CancellationToken cancellationToken) =>
        user.IsInRole("PlatformManager") || await OrganizationAuthorization.CanAdministerSite(siteId, personId, db, cancellationToken);
}
