using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal sealed record LifecycleImpact(bool Eligible, IReadOnlyDictionary<string, long> Blockers);
internal static class LifecycleImpactQuery
{
    internal static async Task<LifecycleImpact> Site(Guid siteId, FylkrenDbContext db, CancellationToken ct)
    {
        var reasons = new Dictionary<string, long>();
        void Add(string code, long count) { if (count > 0) reasons.Add(code, count); }
        Add("active_site", await db.Sites.LongCountAsync(s => s.Id == siteId && s.IsActive, ct));
        Add("active_child_sites", await db.Sites.LongCountAsync(s => s.IsActive && s.ParentOrganizationUnit != null && s.ParentOrganizationUnit.SiteId == siteId, ct));
        Add("unfinished_work", await db.WorkItems.LongCountAsync(w => w.SiteId == siteId && (w.Status != "completed" && w.Status != "rejected" && w.Status != "cancelled" && w.Status != "reassigned" || w.Status == "completed" && w.FinalReportApprovedAt == null), ct));
        Add("open_learning", await db.LearningLessons.LongCountAsync(l => l.SiteId == siteId && (l.Status == "new" || l.Status == "in_progress"), ct));
        Add("open_plans", await db.WorkflowRuns.LongCountAsync(r => r.WorkItem.SiteId == siteId && r.Status != "approved" && r.Status != "rejected" && r.Status != "cancelled", ct));
        Add("open_execution", await db.ExecutionRuns.LongCountAsync(r => r.WorkItem.SiteId == siteId && r.Status != "submitted" && r.Status != "cancelled", ct));
        Add("open_risks", await db.Risks.LongCountAsync(r => r.SiteId == siteId && r.Revisions.OrderByDescending(v => v.Version).Select(v => v.Status).FirstOrDefault() != "closed", ct));
        Add("pending_notifications", await db.NotificationOutboxMessages.LongCountAsync(m => m.SiteId == siteId && m.Status == "pending", ct));
        Add("pending_webhooks", await db.WebhookDeliveries.LongCountAsync(d => d.DomainEvent.SiteId == siteId && d.Status != "succeeded" && d.Status != "failed", ct));
        Add("pending_projection", await db.EventProjections.LongCountAsync(p => p.Status != "completed" && p.Status != "skipped" && db.DomainEvents.Any(e => e.Id == p.DomainEventId && e.SiteId == siteId), ct));
        Add("pending_federation", await db.FederationOutboundMessages.LongCountAsync(m => m.SourceSiteId == siteId && (m.Status == "pending" || m.Status == "retrying"), ct));
        Add("missing_custodian", await db.ArchiveGrants.AnyAsync(g => g.SiteId == siteId && g.IsActive && g.CanExport &&
            db.People.Any(p => p.Id == g.PersonId && p.IsActive && !p.IsDeleted) && db.LoginIdentities.Any(i => i.PersonId == g.PersonId && i.IsActive), ct) ? 0 : 1);
        return new(reasons.Count == 0, reasons);
    }
    internal static async Task<LifecycleImpact> Person(Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var reasons = new Dictionary<string, long>();
        void Add(string code, long count) { if (count > 0) reasons.Add(code, count); }
        Add("active_person", await db.People.LongCountAsync(p => p.Id == personId && p.IsActive, ct));
        Add("active_login", await db.LoginIdentities.LongCountAsync(p => p.PersonId == personId && p.IsActive, ct));
        Add("active_memberships", await db.SiteMemberships.LongCountAsync(m => m.PersonId == personId && m.IsActive && m.Site.IsActive, ct));
        Add("active_manager", await db.SiteManagerAssignments.LongCountAsync(m => m.PersonId == personId && m.IsActive && m.Site.IsActive, ct));
        Add("active_roles", await db.RoleAssignments.LongCountAsync(a => a.PersonId == personId && a.IsActive && a.Role.OrganizationUnit.Site.IsActive, ct));
        Add("archive_responsibility", await db.ArchiveGrants.LongCountAsync(g => g.PersonId == personId && g.IsActive, ct));
        return new(reasons.Count == 0, reasons);
    }
}
