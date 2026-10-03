using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal sealed record LifecycleImpact(bool Eligible, IReadOnlyDictionary<string, int> Blockers);
internal static class LifecycleImpactQuery
{
    internal static async Task<LifecycleImpact> Site(Guid siteId, FylkrenDbContext db, CancellationToken ct)
    {
        var reasons = new Dictionary<string, int>();
        void Add(string code, int count) { if (count > 0) reasons.Add(code, count); }
        Add("active_site", await db.Sites.CountAsync(s => s.Id == siteId && s.IsActive, ct));
        Add("active_child_sites", await db.Sites.CountAsync(s => s.IsActive && s.ParentOrganizationUnit != null && s.ParentOrganizationUnit.SiteId == siteId, ct));
        Add("unfinished_work", await db.WorkItems.CountAsync(w => w.SiteId == siteId && (w.Status != "completed" && w.Status != "rejected" && w.Status != "cancelled" && w.Status != "reassigned" || w.Status == "completed" && w.FinalReportApprovedAt == null), ct));
        Add("open_learning", await db.LearningLessons.CountAsync(l => l.SiteId == siteId && (l.Status == "new" || l.Status == "in_progress"), ct));
        Add("open_plans", await db.WorkflowRuns.CountAsync(r => r.WorkItem.SiteId == siteId && r.Status != "approved" && r.Status != "rejected" && r.Status != "cancelled", ct));
        Add("open_execution", await db.ExecutionRuns.CountAsync(r => r.WorkItem.SiteId == siteId && r.Status != "submitted" && r.Status != "cancelled", ct));
        Add("open_risks", await db.Risks.CountAsync(r => r.SiteId == siteId && r.Revisions.OrderByDescending(v => v.Version).Select(v => v.Status).FirstOrDefault() != "closed", ct));
        Add("pending_notifications", await db.NotificationOutboxMessages.CountAsync(m => m.SiteId == siteId && m.Status == "pending", ct));
        Add("pending_webhooks", await db.WebhookDeliveries.CountAsync(d => d.DomainEvent.SiteId == siteId && d.Status != "succeeded" && d.Status != "failed", ct));
        Add("pending_projection", await db.EventProjections.CountAsync(p => p.Status != "completed" && p.Status != "skipped" && db.DomainEvents.Any(e => e.Id == p.DomainEventId && e.SiteId == siteId), ct));
        Add("pending_federation", await db.FederationOutboundMessages.CountAsync(m => m.SourceSiteId == siteId && (m.Status == "pending" || m.Status == "retrying"), ct));
        Add("missing_custodian", await db.ArchiveGrants.AnyAsync(g => g.SiteId == siteId && g.IsActive && g.CanExport &&
            db.People.Any(p => p.Id == g.PersonId && p.IsActive && !p.IsDeleted) && db.LoginIdentities.Any(i => i.PersonId == g.PersonId && i.IsActive), ct) ? 0 : 1);
        return new(reasons.Count == 0, reasons);
    }
    internal static async Task<LifecycleImpact> Person(Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var reasons = new Dictionary<string, int>();
        void Add(string code, int count) { if (count > 0) reasons.Add(code, count); }
        Add("active_person", await db.People.CountAsync(p => p.Id == personId && p.IsActive, ct));
        Add("active_login", await db.LoginIdentities.CountAsync(p => p.PersonId == personId && p.IsActive, ct));
        Add("active_memberships", await db.SiteMemberships.CountAsync(m => m.PersonId == personId && m.IsActive && m.Site.IsActive, ct));
        Add("active_manager", await db.SiteManagerAssignments.CountAsync(m => m.PersonId == personId && m.IsActive && m.Site.IsActive, ct));
        Add("active_roles", await db.RoleAssignments.CountAsync(a => a.PersonId == personId && a.IsActive && a.Role.OrganizationUnit.Site.IsActive, ct));
        Add("archive_responsibility", await db.ArchiveGrants.CountAsync(g => g.PersonId == personId && g.IsActive, ct));
        return new(reasons.Count == 0, reasons);
    }
}
