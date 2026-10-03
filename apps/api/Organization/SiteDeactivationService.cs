using Fylkren.Api.Persistence;
using Fylkren.Api.Federation;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class SiteDeactivationService
{
    internal static Task<bool> HasActiveChildrenAsync(
        Guid siteId,
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        database.Sites.AnyAsync(site =>
            site.IsActive &&
            site.ParentOrganizationUnit != null &&
            site.ParentOrganizationUnit.SiteId == siteId,
            cancellationToken);

    internal static async Task DeactivateAsync(
        Site site,
        FylkrenDbContext database,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        site.Update(site.Name, site.ParentOrganizationUnitId, false);
        await FederationSitePublicationPolicy.SuspendAsync(site.Id, database, now, cancellationToken);

        foreach (var membership in await database.SiteMemberships
                     .Where(value => value.SiteId == site.Id && value.IsActive)
                     .ToListAsync(cancellationToken))
            membership.Deactivate();

        foreach (var assignment in await database.SiteManagerAssignments
                     .Where(value => value.SiteId == site.Id && value.IsActive)
                     .ToListAsync(cancellationToken))
            assignment.Deactivate();

        foreach (var assignment in await database.RoleAssignments
                     .Where(value => value.IsActive &&
                         value.Role.OrganizationUnit.SiteId == site.Id)
                     .ToListAsync(cancellationToken))
            assignment.Deactivate();

        database.OrganizationUnitMemberships.RemoveRange(
            await database.OrganizationUnitMemberships
                .Where(value => value.SiteId == site.Id)
                .ToListAsync(cancellationToken));

        foreach (var run in await database.WorkflowRuns
                     .Where(value => value.WorkItem.SiteId == site.Id &&
                         value.ClaimedByPersonId != null &&
                         value.Status == "in_progress")
                     .ToListAsync(cancellationToken))
        {
            run.Release();
            Fylkren.Api.DomainEvents.WorkActivity.Add(database, Fylkren.Api.ActivityAudit.AuditEvent.FromSystem(Guid.NewGuid(), "site-deactivation", "workflow.released-on-site-deactivation", "workflow-run", run.Id, now, site.Id), "assignment.released");
        }

        foreach (var run in await database.ExecutionRuns
                     .Where(value => value.WorkItem.SiteId == site.Id &&
                         value.ClaimedByPersonId != null &&
                         value.Status != "submitted" &&
                         value.Status != "cancelled")
                     .ToListAsync(cancellationToken))
        {
            run.Release(now);
            Fylkren.Api.DomainEvents.WorkActivity.Add(database, Fylkren.Api.ActivityAudit.AuditEvent.FromSystem(Guid.NewGuid(), "site-deactivation", "execution.released-on-site-deactivation", "execution-run", run.Id, now, site.Id), "assignment.released");
        }
    }
}
