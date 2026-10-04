using System.Diagnostics;
using System.Text.Json;
using Fylkren.Api.Federation;
using Fylkren.Api.Identity;
using Fylkren.Api.Learning;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

internal static class NavigationCountTests
{
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    internal static async Task Run(FylkrenDbContext db, bool measure)
    {
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow; var total = 180;
        var sites = Enumerable.Range(0, 3).Select(i => new Site(Guid.NewGuid(), $"Synthetic navigation Site {i}", now)).ToArray();
        var people = Enumerable.Range(0, 9).Select(i => new Person(Guid.NewGuid(), $"Synthetic navigation actor {i}", now)).ToArray();
        db.Sites.AddRange(sites); db.People.AddRange(people);
        if (!await db.PlatformReferenceSettings.AnyAsync()) db.PlatformReferenceSettings.Add(new(3, 1, now, null));
        foreach (var (site, index) in sites.Select((s, i) => (s, i))) db.SiteReferenceSettings.Add(new(site.Id, $"NAV{index}", now, null));
        var units = new List<OrganizationUnit>();
        foreach (var site in sites)
        {
            var root = new OrganizationUnit(Guid.NewGuid(), site.Id, null, "Root", false, now, isSiteRoot: true);
            var lead = new OrganizationUnit(Guid.NewGuid(), site.Id, root.Id, "Leadership", false, now, isSiteLeadership: true);
            units.Add(root); units.Add(lead);
            for (var i = 0; i < 6; i++) units.Add(new OrganizationUnit(Guid.NewGuid(), site.Id, i < 2 ? lead.Id : units[^2].Id, $"Unit {i}", false, now));
            units.Add(new OrganizationUnit(Guid.NewGuid(), site.Id, lead.Id, "Parent-level staff", false, now, worksAtParentLevel: true));
        }
        db.OrganizationUnits.AddRange(units);
        sites[1].Update(sites[1].Name, units.First(u => u.SiteId == sites[0].Id && u.IsSiteLeadership).Id, true);
        sites[2].Update(sites[2].Name, units.First(u => u.SiteId == sites[1].Id && u.IsSiteLeadership).Id, true);
        // Actor 0 leads all levels in A/B; C is foreign despite an active role.
        foreach (var site in sites.Take(2)) db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), site.Id, people[0].Id, now));
        foreach (var unit in units.Where(u => !u.IsSiteRoot)) Assign(people[0], unit, true);
        foreach (var person in people.Skip(1).Take(7)) db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), sites[0].Id, person.Id, now));
        var leadership = units.First(u => u.SiteId == sites[0].Id && u.IsSiteLeadership);
        var division = units.First(u => u.SiteId == sites[0].Id && u.Name == "Unit 0");
        Assign(people[1], leadership, true);
        Assign(people[2], division, true);
        Assign(people[3], division, false, canPlan: true);
        db.OrganizationUnitMemberships.Add(new OrganizationUnitMembership(Guid.NewGuid(), sites[0].Id, division.Id, people[4].Id, now));
        Assign(people[5], units.First(u => u.SiteId == sites[0].Id && u.WorksAtParentLevel), true, parentLeadership: true);
        Assign(people[6], leadership, true, expired: true);
        Assign(people[7], leadership, true, future: true);
        Assign(people[8], leadership, true); // no active Site membership
        var requestTypes = sites.Select(s => new WorkItemType(Guid.NewGuid(), s.Id, "Request", "REQ", now, true)).ToArray();
        db.WorkItemTypes.AddRange(requestTypes);
        var definitions = sites.Select(s => new WorkflowDefinition(Guid.NewGuid(), s.Id, null, "Plan", "planning", false)).ToArray();
        db.WorkflowDefinitions.AddRange(definitions);
        await db.SaveChangesAsync();
        var statuses = new[] { "registered", "under_review", "planning_approval", "planning_approved", "in_review", "request_cancelled", "assigned", "in_progress", "planning", "execution", "on_hold", "completed", "rejected", "cancelled", "reassigned" };
        var items = new List<WorkItem>();
        for (var i = 0; i < total; i++)
        {
            var siteIndex = i % 3; var site = sites[siteIndex]; var siteUnits = units.Where(u => u.SiteId == site.Id && !u.IsSiteRoot).ToArray();
            var unit = i % 7 == 0 ? null : (Guid?)siteUnits[(i / 3) % siteUnits.Length].Id;
            var item = new WorkItem(Guid.NewGuid(), site.Id, people[0].Id, $"Synthetic navigation item {i}", "Private body excluded from count", null, "normal", null, now,
                parentWorkItemId: i > 60 && i % 4 == 0 ? items[30 + i % 24].Id : i > 30 && i % 4 == 0 ? items[i % 24].Id : null,
                workItemTypeId: i % 5 == 0 ? requestTypes[siteIndex].Id : null, senderSiteName: i % 11 == 0 ? "Synthetic sender" : null);
            if (unit is Guid id) item.RegisterAtUnit(id, now);
            item.TransitionWithinLevel(i < total / 3 ? "registered" : statuses[(i / 3) % statuses.Length], null, now);
            items.Add(item); db.WorkItems.Add(item);
            if (item.Status == "planning")
            {
                var run = new WorkflowRun(Guid.NewGuid(), item.Id, definitions[siteIndex].Id);
                if (i % 2 == 0) run.Claim(people[0].Id, now);
                db.WorkflowRuns.Add(run);
            }
            if (item.Status == "execution" && i % 3 == 0)
            {
                var run = new ExecutionRun(Guid.NewGuid(), item.Id, people[0].Id, now);
                if (i % 2 == 0) run.Release(now);
                db.ExecutionRuns.Add(run);
            }
        }
        await db.SaveChangesAsync();
        for (var i = 30; i < total; i += 17)
            db.WorkItemDependencies.Add(new WorkItemDependency(Guid.NewGuid(), items[i].SiteId, items[i - 3].Id, items[i].Id, WorkItemDependency.FinishToStart, people[0].Id, now));
        var lessonNumber = 0;
        foreach (var unit in units.Where(u => !u.IsSiteRoot && !u.WorksAtParentLevel))
        {
            var item = items.First(x => x.SiteId == unit.SiteId);
            for (var number = 1; number <= 3; number++)
            {
                var lesson = new LearningLesson(Guid.NewGuid(), unit.SiteId, item.Id, unit.Id, ++lessonNumber, "worked", "Private learning", people[0].Id, people[0].DisplayName, now);
                if (number > 1) lesson.Review(number == 2 ? "in_progress" : "closed", "normal", "", "", null, people[0].Id, people[0].DisplayName, now);
                db.LearningLessons.Add(lesson);
            }
        }
        // Federated terminal, pending, received, incoming and official-answer cases;
        // include a completed local counterpart so remote progress must take precedence.
        for (var i = 0; i < 30; i += 5)
        {
            var parent = items[i];
            var child = new WorkItem(Guid.NewGuid(), sites[(i % 3 + 1) % 3].Id, people[0].Id, "Synthetic foreign counterpart", "", null, "normal", null, now, parent.Id, senderSiteName: "Remote sender");
            child.TransitionWithinLevel(i % 10 == 0 ? "completed" : "in_progress", null, now);
            db.WorkItems.Add(child);
            var peer = Guid.NewGuid(); var link = new FederationWorkLink(Guid.NewGuid(), parent.Id, peer, Guid.NewGuid(), Guid.NewGuid(), parent.SiteId, parent.Id, i == 25 ? "incoming" : "outgoing", now);
            if (i == 5) link.Acknowledge(Guid.NewGuid(), now);
            if (i == 10) link.RecordOfficialAnswer(Guid.NewGuid(), "Private official answer", null, now, "Remote");
            db.FederationPeers.Add(new FederationPeer(peer, $"Synthetic peer {i}", $"https://peer-{i}.example.invalid", now));
            db.FederationWorkLinks.Add(link);
        }
        await db.SaveChangesAsync();
        // Historical progress may contain terminal values from prior compatible peers.
        await db.Database.ExecuteSqlRawAsync("UPDATE federation_work_links SET remote_progress_status='rejected' WHERE local_work_item_id={0}", items[15].Id);
        await db.Database.ExecuteSqlRawAsync("UPDATE federation_work_links SET remote_progress_status='cancelled' WHERE local_work_item_id={0}", items[20].Id);
        if (measure)
        {
            // Keep the maintained workload-load fixture: 1,000 registered tasks
            // at the Site leadership level, in addition to the hierarchy cases.
            for (var i = 0; i < 1000; i++)
            {
                var load = new WorkItem(Guid.NewGuid(), sites[0].Id, people[0].Id, $"Synthetic load item {i:D4}", "Disposable performance fixture", null, "normal", null, now);
                load.RegisterAtUnit(leadership.Id, now); db.WorkItems.Add(load);
            }
            await db.SaveChangesAsync();
        }
        db.ChangeTracker.Clear();
        await db.Database.ExecuteSqlRawAsync("ANALYZE");
        foreach (var person in people)
        {
            var expected = await NavigationCountReference.Read(person.Id, db, default);
            var actual = await WorkNavigationCountEndpoints.Read(person.Id, db, default);
            Require(actual == expected, $"Count/authorization drift for {person.DisplayName}: {actual} != {expected}");
            if (person.Id == people[6].Id || person.Id == people[7].Id || person.Id == people[8].Id) Require(actual == new WorkNavigationCountEndpoints.Counts(0, 0, 0, 0), "Expired/future/foreign membership gained pending counts.");
        }
        // Explicitly exercise an administrative/member identity with no operational grants.
        var admin = new Person(Guid.NewGuid(), "Synthetic administrator", now); db.People.Add(admin);
        db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), sites[0].Id, admin.Id, now)); await db.SaveChangesAsync();
        Require(await WorkNavigationCountEndpoints.Read(admin.Id, db, default) == new WorkNavigationCountEndpoints.Counts(0, 0, 0, 0), "Administration alone granted work counts.");
        var membership = await db.SiteMemberships.SingleAsync(x => x.SiteId == sites[1].Id && x.PersonId == people[0].Id); membership.Deactivate(); await db.SaveChangesAsync();
        Require(await WorkNavigationCountEndpoints.Read(people[0].Id, db, default) == await NavigationCountReference.Read(people[0].Id, db, default), "Revoked membership retained cached counts.");
        // Restore membership by adding an active row is not permitted; use the model's reactivation.
        membership.Activate(); await db.SaveChangesAsync();
        var result = await WorkNavigationCountEndpoints.Read(people[0].Id, db, default);
        using (var response = JsonDocument.Parse(JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web))))
            Require(response.RootElement.EnumerateObject().Select(x => x.Name).SequenceEqual(new[] { "tasks", "planning", "execution", "learning" }), "Navigation API response contract changed.");
        if (measure) await NavigationCountMeasurements.Run(db, people[0].Id);
        var directRole = await db.RoleAssignments.SingleAsync(x => x.PersonId == people[2].Id && x.Role.OrganizationUnitId == division.Id);
        directRole.Deactivate(); await db.SaveChangesAsync();
        Require(await WorkNavigationCountEndpoints.Read(people[2].Id, db, default) == new WorkNavigationCountEndpoints.Counts(0, 0, 0, 0), "Revoked role retained count access.");
        sites[1].Update(sites[1].Name, sites[1].ParentOrganizationUnitId, false); await db.SaveChangesAsync();
        Require(await WorkNavigationCountEndpoints.Read(people[0].Id, db, default) == await NavigationCountReference.Read(people[0].Id, db, default), "Inactive Site leaked counts.");
        Console.WriteLine($"Navigation count database tests passed: {total + (measure ? 1000 : 0)} base tasks plus six cross-Site counterparts, three Sites/27 units, null leadership/parent-level/multiple role predicates, dependencies, hierarchy, planning/execution ownership, local/federated progress, exact-level learning and immediate membership revocation; unchanged reference totals.");

        void Assign(Person person, OrganizationUnit unit, bool leader, bool canPlan = false, bool parentLeadership = false, bool expired = false, bool future = false)
        {
            var role = leader ? db.OrganizationRoles.Local.SingleOrDefault(r => r.OrganizationUnitId == unit.Id && r.IsLeader) : null;
            if (role is null)
            {
                role = new OrganizationRole(Guid.NewGuid(), unit.Id, $"Role {person.Id:N}", leader, now); role.Update(unit.Id, role.Name, canPlan: canPlan);
                db.OrganizationRoles.Add(role);
            }
            db.RoleAssignments.Add(new RoleAssignment(Guid.NewGuid(), role.Id, person.Id, future ? now.AddDays(1) : now.AddDays(-2), expired ? now.AddDays(-1) : null, now, parentLeadership));
        }
    }
}
