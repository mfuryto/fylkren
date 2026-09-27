using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationSiteGrantPolicy
{
    // Recheck the receiver's current state for each incoming work message.
    // A successful earlier reciprocal check is never durable authorization.
    internal static async Task<long?> ActiveInboundRevisionAsync(Guid peerInstanceId,
        Guid sourceSiteId, Guid destinationSiteId, FylkrenDbContext db, CancellationToken ct)
    {
        var localDestination = await db.Sites.AsNoTracking().AnyAsync(site =>
            site.Id == destinationSiteId && site.IsActive && site.ParentOrganizationUnitId == null, ct);
        if (!localDestination) return null;
        var knownSource = await db.FederationRemoteSites.AsNoTracking().AnyAsync(value =>
            value.InstanceId == peerInstanceId && value.SiteId == sourceSiteId && value.IsActive, ct);
        if (!knownSource) return null;
        return await db.FederationSiteGrants.AsNoTracking().Where(value =>
            value.PeerInstanceId == peerInstanceId && value.LocalSiteId == destinationSiteId &&
            value.RemoteSiteId == sourceSiteId && value.Direction == "inbound" && value.IsActive)
            .Select(value => (long?)value.Revision).SingleOrDefaultAsync(ct);
    }

    internal static async Task SuspendLocalAsync(Guid siteId, FylkrenDbContext db, DateTimeOffset at, CancellationToken ct)
    {
        var grants = await db.FederationSiteGrants
            .Where(grant => grant.LocalSiteId == siteId && grant.IsActive).ToListAsync(ct);
        foreach (var grant in grants) grant.SetActive(false, at);
    }

    internal static async Task SuspendPublicationAsync(Guid peerInstanceId, Guid localSiteId,
        FylkrenDbContext db, DateTimeOffset at, CancellationToken ct)
    {
        var grants = await db.FederationSiteGrants
            .Where(grant => grant.PeerInstanceId == peerInstanceId && grant.LocalSiteId == localSiteId && grant.IsActive)
            .ToListAsync(ct);
        foreach (var grant in grants) grant.SetActive(false, at);
    }

    internal static async Task SuspendRemoteAsync(Guid peerInstanceId, Guid remoteSiteId,
        FylkrenDbContext db, DateTimeOffset at, CancellationToken ct)
    {
        var grants = await db.FederationSiteGrants
            .Where(grant => grant.PeerInstanceId == peerInstanceId && grant.RemoteSiteId == remoteSiteId && grant.IsActive)
            .ToListAsync(ct);
        foreach (var grant in grants) grant.SetActive(false, at);
    }

    internal static async Task SuspendPeerAsync(Guid peerInstanceId, FylkrenDbContext db, DateTimeOffset at, CancellationToken ct)
    {
        var grants = await db.FederationSiteGrants
            .Where(grant => grant.PeerInstanceId == peerInstanceId && grant.IsActive).ToListAsync(ct);
        foreach (var grant in grants) grant.SetActive(false, at);
    }
}
