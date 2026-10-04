using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Approvals;

internal static class FormalApprovalService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    internal static async Task<DomainObjectVersion> Approve(FylkrenDbContext db, Guid siteId, string objectType, Guid objectId, Guid contextWorkItemId, string title, object snapshot, Guid approverId, DateTimeOffset now, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(snapshot, JsonOptions);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        var number = NumericBounds.NextVersion(await db.DomainObjectVersions.Where(x => x.SiteId == siteId && x.ObjectType == objectType && x.ObjectId == objectId).MaxAsync(x => (int?)x.VersionNumber, ct) ?? 0);
        var approverName = await db.People.Where(x => x.Id == approverId).Select(x => x.DisplayName).SingleAsync(ct);
        var version = new DomainObjectVersion(Guid.NewGuid(), siteId, objectType, objectId, contextWorkItemId, number, title, json, hash, approverId, now);
        version.MarkApproved();
        db.DomainObjectVersions.Add(version);
        db.FormalApprovalSignoffs.Add(new FormalApprovalSignoff(Guid.NewGuid(), version.Id, approverId, approverName, "approved", now));
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, approverId, "formal-approval.approved", objectType, objectId, now));
        return version;
    }
}
