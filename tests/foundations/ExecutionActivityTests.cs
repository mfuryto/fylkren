using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

internal static class ExecutionActivityTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), "Synthetic execution activity", now);
        var person = new Person(Guid.NewGuid(), "Synthetic executor", now);
        db.Sites.Add(site); db.People.Add(person);
        db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), site.Id, person.Id, now));
        if (!await db.PlatformReferenceSettings.AnyAsync()) db.PlatformReferenceSettings.Add(new(3, 1, now, null));
        db.SiteReferenceSettings.Add(new(site.Id, "EXEC", now, null));
        await db.SaveChangesAsync();
        var item = new WorkItem(Guid.NewGuid(), site.Id, person.Id, "Synthetic execution task", "", null, "normal", null, now);
        var definition = new WorkflowDefinition(Guid.NewGuid(), site.Id, null, "Synthetic three steps", "execution", false);
        var steps = Enumerable.Range(1, 3).Select(i => new WorkflowStep(Guid.NewGuid(), definition.Id, $"Stage {i}", i * 10, false, hasTimeline: true)).ToArray();
        var run = new ExecutionRun(Guid.NewGuid(), item.Id, person.Id, now); run.Start(definition.Id, now);
        db.WorkItems.Add(item); db.WorkflowDefinitions.Add(definition); db.WorkflowSteps.AddRange(steps); db.ExecutionRuns.Add(run);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), site.Id, person.Id, "work-item.registered", "work-item", item.Id, now), "task.created");
        await db.SaveChangesAsync();
        async Task Save(WorkflowStep step, string text, params ExecutionDocumentTimeline[] events)
        {
            if (await ExecutionStepActivity.Document(db, run, step, person.Id, text, events, default)) await db.SaveChangesAsync();
        }
        async Task Select(int index)
        {
            if (ExecutionStepActivity.Select(db, run, steps[index], index, person.Id)) await db.SaveChangesAsync();
        }
        async Task<int> Facts() => await db.DomainEvents.CountAsync(x => x.ResourceId == run.Id);
        await Save(steps[0], "   "); await Select(0);
        Require(await Facts() == 0 && !await db.ExecutionStepDocuments.AnyAsync(x => x.RunId == run.Id), "Empty initial save or unchanged selection created history/content.");
        db.ExecutionStepDocuments.Add(new ExecutionStepDocument(Guid.NewGuid(), run.Id, steps[0].Id, "Template content", now));
        await db.SaveChangesAsync();
        await Save(steps[0], "Template content");
        Require(await Facts() == 0, "Unchanged template generated a documentation event.");
        for (var i = 0; i < steps.Length; i++)
        {
            await Select(i);
            await Save(steps[i], $"PRIVATE_DOCUMENT_{i}");
            var document = await db.ExecutionStepDocuments.AsNoTracking().SingleAsync(x => x.RunId == run.Id && x.StepId == steps[i].Id);
            await Save(steps[i], $"  PRIVATE_DOCUMENT_{i}  "); // autosave followed by Next
            Require((await db.ExecutionStepDocuments.AsNoTracking().SingleAsync(x => x.Id == document.Id)).UpdatedAt == document.UpdatedAt, "Unchanged save rewrote the document timestamp.");
        }
        Require(await Facts() == 5 && await db.AuditEvents.CountAsync(x => x.EntityId == run.Id && x.EventType == "execution.step-documented") == 3 &&
            await db.AuditEvents.CountAsync(x => x.EntityId == run.Id && x.EventType == "execution.step-changed") == 2, "Three stages did not produce exactly three documentation and two selection facts.");
        var timeline = new[] { new ExecutionDocumentTimeline(new DateOnly(2026, 10, 4), "PRIVATE_TIMELINE_A"), new ExecutionDocumentTimeline(new DateOnly(2026, 10, 5), "PRIVATE_TIMELINE_B") };
        await Save(steps[2], "PRIVATE_DOCUMENT_2", timeline);
        var ids = await db.ExecutionTimelineEvents.Where(x => x.RunId == run.Id).OrderBy(x => x.SortOrder).Select(x => x.Id).ToArrayAsync();
        await Save(steps[2], " PRIVATE_DOCUMENT_2 ", timeline.Select(x => x with { Description = $" {x.Description} " }).ToArray());
        var repeatedIds = await db.ExecutionTimelineEvents.Where(x => x.RunId == run.Id).OrderBy(x => x.SortOrder).Select(x => x.Id).ToArrayAsync();
        Require(await Facts() == 6 && ids.SequenceEqual(repeatedIds), "Unchanged timeline created activity or replaced retained timeline IDs.");
        await Save(steps[2], "Updated document", timeline);
        var textOnlyIds = await db.ExecutionTimelineEvents.Where(x => x.RunId == run.Id).OrderBy(x => x.SortOrder).Select(x => x.Id).ToArrayAsync();
        Require(ids.SequenceEqual(textOnlyIds), "Text-only edit replaced timeline IDs.");
        await Save(steps[2], "Updated document", timeline.Reverse().ToArray());
        await Save(steps[2], "Updated document");
        Require(await Facts() == 9 && !await db.ExecutionTimelineEvents.AnyAsync(x => x.RunId == run.Id), "Timeline reorder/removal was not recorded.");
        // Templates already exist at workflow creation; merely opening/saving is not documentation.
        db.ChangeTracker.Clear();
        run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleAsync(x => x.Id == run.Id);
        await Save(steps[0], "PRIVATE_DOCUMENT_0");
        Require(await Facts() == 9, "Existing/template content was logged again without an edit.");
        var facts = await db.DomainEvents.AsNoTracking().Where(x => x.ResourceId == run.Id).ToListAsync();
        foreach (var fact in facts)
        {
            var details = ExecutionActivityDetails.Read(fact.ActivityMetadataJson);
            Require(details.StepNumber is >= 1 and <= 3 && details.StepName == $"Stage {details.StepNumber}", "Step snapshot used sortOrder as a display number or lost its name.");
            Require(!fact.ActivityMetadataJson.Contains("PRIVATE_") && await db.AuditEvents.AnyAsync(x => x.DomainEventId == fact.Id), "Private document content entered metadata or independent audit correlation was lost.");
        }
        Require(ExecutionActivityDetails.Read("{\"status\":\"execution\"}") == new ExecutionActivityDetails(null, null), "Legacy events acquired invented step details.");
        var page = (Microsoft.AspNetCore.Http.IValueHttpResult)await ActivityQueryEndpoints.Page(
            db.DomainEvents.AsNoTracking().Where(x => x.ResourceId == run.Id), null, null, null, null, null, null, 25, db, default);
        var json = System.Text.Json.JsonSerializer.Serialize(page.Value, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
        using var response = System.Text.Json.JsonDocument.Parse(json);
        var rows = response.RootElement.GetProperty("items").EnumerateArray().ToArray();
        Require(rows.Length == 9 && rows.Count(x => x.GetProperty("action").GetString() == "execution.step-changed") == 2 && rows.All(x => x.GetProperty("stepNumber").GetInt32() > 0), "Activity read omitted correlated actions or step snapshots.");
        foreach (var invalid in new[] { "{\"stepNumber\":0}", "{\"stepNumber\":\"1\"}", "{\"stepName\":true}" })
        {
            try { ActivityEventCatalog.ValidateMetadata("execution.updated", invalid); throw new Exception("Invalid step metadata accepted."); }
            catch (ArgumentException) { }
        }
        Console.WriteLine("Execution activity tests passed: three documentation facts/two selections; repeated, empty and trimmed saves skipped; timeline edits preserved; step snapshots and independent audit correlated without private content.");
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
}
