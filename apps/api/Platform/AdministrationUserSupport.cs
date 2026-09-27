using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.Platform.AdministrationApiSupport;

namespace Fylkren.Api.Platform;

internal static class AdministrationUserSupport
{
    internal static string RequestHash(string operation, Guid personId, object request) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { operation, personId, request })))).ToLowerInvariant();

    internal static async Task<IResult?> CheckIdempotency(Guid machineId, HttpContext context, string hash, FylkrenDbContext db, CancellationToken ct)
    {
        var key = context.Request.Headers["Idempotency-Key"].ToString().Trim();
        if (key.Length is < 8 or > 128 || key.Any(character => !(char.IsAsciiLetterOrDigit(character) || "._:-".Contains(character))))
            return Problem(context, 400, "invalid_idempotency_key", "Idempotency-Key må bestå av 8–128 tillatte tegn.");
        var record = await db.ApiIdempotencyRecords.AsNoTracking().SingleOrDefaultAsync(value => value.MachineIdentityId == machineId && value.Key == key, ct);
        if (record is null) return null;
        return record.RequestHash == hash
            ? Results.Ok(new { id = record.ResourceId, replayed = true })
            : Problem(context, 409, "idempotency_key_reused", "Idempotency-Key er allerede brukt med et annet innhold.");
    }

    internal static void AddIdempotency(FylkrenDbContext db, Guid machineId, HttpContext context, string hash, Guid resourceId, DateTimeOffset now) =>
        db.ApiIdempotencyRecords.Add(new ApiIdempotencyRecord(Guid.NewGuid(), machineId, context.Request.Headers["Idempotency-Key"].ToString().Trim(), hash, resourceId, now));

    internal static void AddAudit(FylkrenDbContext db, Guid machineId, Guid? siteId, string eventType, Guid personId, HttpContext context, DateTimeOffset now) =>
        db.ApiMachineAuditEvents.Add(new ApiMachineAuditEvent(Guid.NewGuid(), machineId, siteId, eventType, "person", personId, context.TraceIdentifier, now));

}

