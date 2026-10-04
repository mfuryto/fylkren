using System.Security.Claims;
using System.Data;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Portability;

public static partial class PortabilityEndpoints
{
    private static readonly SemaphoreSlim ImportValidationSlot = new(1, 1);

    public static IEndpointRouteBuilder MapPortabilityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/portability").RequireAuthorization();
        group.MapPost("/sites/{siteId:guid}/export", Export).RequireRateLimiting("costly-operation");
        group.MapGet("/sites/{siteId:guid}/exports", Receipts);
        group.MapGet("/sites/{siteId:guid}/exit", ExitStatus);
        group.MapPost("/sites/{siteId:guid}/exports/{exportId:guid}/acknowledge", Acknowledge);
        group.MapPost("/sites/{siteId:guid}/imports/validate", ValidateImport)
            .RequireRateLimiting("bounded-upload")
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(PortableExportPackage.MaximumImportRequestBytes))
            .WithMetadata(new RequestFormLimitsAttribute { MultipartBodyLengthLimit = PortableExportPackage.MaximumImportRequestBytes });
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
        if (!PersonId(user, out var actorPersonId)) return Results.Problem(statusCode: 403);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);
        if (!(await CanAdminister(siteId, actorPersonId, user, db, cancellationToken) || await Fylkren.Api.InformationLifecycle.ArchiveAccess.CanExport(siteId, actorPersonId, db, cancellationToken)))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
        if (!await db.Sites.AnyAsync(value => value.Id == siteId, cancellationToken)) return Results.NotFound();
        try
        {
            var content = await PortableExportPackage.Create(siteId, actorPersonId, db, cancellationToken);
            var receipt = db.ExportReceipts.Local.Single(r => r.SiteId == siteId);
            context.Response.Headers["X-Fylkren-Export-Id"] = receipt.Id.ToString();
            context.Response.Headers["X-Fylkren-Package-Sha256"] = receipt.PackageSha256;
            await transaction.CommitAsync(cancellationToken);
            return Results.File(content, "application/zip", $"fylkren-site-{siteId:N}-export.zip");
        }
        catch (PortableExportIntegrityException)
        {
            return Results.Conflict(new { code = "portable_export_incomplete", error = "Export relationships could not be validated. No export receipt was created." });
        }
        catch (PortablePackageTooLargeException)
        {
            return Results.Problem(statusCode: StatusCodes.Status413PayloadTooLarge, title: "The export exceeds the package size or file count limit.");
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
        if (!request.HasFormContentType) return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["Upload a Fylkren export package."] });
        if (!await ImportValidationSlot.WaitAsync(0, cancellationToken))
        {
            context.Response.Headers.RetryAfter = "1";
            return Results.StatusCode(StatusCodes.Status429TooManyRequests);
        }
        try
        {
            var form = await request.ReadFormAsync(cancellationToken);
            var file = form.Files.GetFile("package");
            if (file is null || file.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["The export package is missing or empty."] });
            if (file.Length > PortableExportPackage.MaximumPackageBytes) return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["The export package cannot exceed 16 MiB."] });
            if (!string.Equals(Path.GetExtension(file.FileName), ".zip", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(file.ContentType, "application/zip", StringComparison.OrdinalIgnoreCase))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["package"] = ["Use a .zip Fylkren export package with media type application/zip."] });
            await using var stream = file.OpenReadStream();
            var result = await PortableImportValidator.Validate(stream, siteId, cancellationToken);
            var now = DateTimeOffset.UtcNow;
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, result.Valid ? "portability.import-package-validated" : "portability.import-package-rejected", "portable-export", result.ExportId == Guid.Empty ? siteId : result.ExportId, now));
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(result);
        }
        finally
        {
            ImportValidationSlot.Release();
        }
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
