using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal static class CryptoReprotectionEndpoints
{
    internal static IEndpointRouteBuilder MapCryptoReprotectionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/cryptography/reprotection")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapGet("", async (FylkrenDbContext db, CancellationToken ct) =>
            Results.Ok((await db.CryptoReprotectionOperations.AsNoTracking()
                .OrderByDescending(value => value.CreatedAt).Take(20).ToListAsync(ct)).Select(Response)));

        group.MapGet("/{id:guid}", async (Guid id, FylkrenDbContext db, CancellationToken ct) =>
        {
            var value = await db.CryptoReprotectionOperations.AsNoTracking()
                .SingleOrDefaultAsync(row => row.Id == id, ct);
            return value is null ? Results.NotFound() : Results.Ok(Response(value));
        });

        group.MapPost("", async (StartRequest request, ClaimsPrincipal user, IAntiforgery antiforgery,
            HttpContext context, CryptoReprotectionService service, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            var backup = request.BackupReference?.Trim() ?? string.Empty;
            var rollback = request.RollbackReference?.Trim() ?? string.Empty;
            if (!Valid(backup, 200) || !Valid(rollback, 500))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["recovery"] = ["A bounded backup reference and rollback reference are required."]
                });
            var value = await service.Create(actor, backup, rollback, db, ct);
            return value is null
                ? Results.Conflict(new { code = "crypto_reprotection_incomplete" })
                : Results.Created($"/api/platform/cryptography/reprotection/{value.Id}", Response(value));
        }).RequireRateLimiting("costly-operation");

        group.MapPost("/{id:guid}/continue", async (Guid id, ContinueRequest request,
            ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            CryptoReprotectionService service, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            if (request.BatchSize is < 1 or > CryptoReprotectionService.MaximumBatchSize)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["batchSize"] = [$"Batch size must be between 1 and {CryptoReprotectionService.MaximumBatchSize}."]
                });
            var value = await service.Continue(id, actor, request.BatchSize, db, ct);
            return value is null ? Results.NotFound() : Results.Ok(Response(value));
        }).RequireRateLimiting("costly-operation");
        return endpoints;
    }

    private static bool Valid(string value, int maximum) =>
        value.Length is > 0 && value.Length <= maximum && !value.Any(char.IsControl);

    private static object Response(CryptoReprotectionOperation value) => new
    {
        value.Id, value.Status, value.TotalItems, value.CompletedItems, value.CreatedAt,
        value.StartedAt, value.CompletedAt, value.FailedAt, value.FailureCode,
        value.BackupReference, value.RollbackReference
    };

    private sealed record StartRequest(string? BackupReference, string? RollbackReference);
    private sealed record ContinueRequest(int BatchSize = 50);
}
