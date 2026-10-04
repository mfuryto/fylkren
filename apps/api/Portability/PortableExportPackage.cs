using System.IO.Compression;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;

namespace Fylkren.Api.Portability;

internal static class PortableExportPackage
{
    internal const string Format = "fylkren-portable-export";
    internal const string FormatVersion = "1.1";
    internal const long MaximumPackageBytes = 16L * 1024 * 1024;
    internal const long MaximumImportRequestBytes = MaximumPackageBytes + 1024 * 1024;
    internal const int MaximumEntries = 250;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };
    private static readonly JsonSerializerOptions RowJsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    internal static async Task<byte[]> Create(
        Guid siteId,
        Guid actorPersonId,
        FylkrenDbContext db,
        CancellationToken cancellationToken,
        long maximumBytes = MaximumPackageBytes)
    {
        if (maximumBytes is < 1 or > MaximumPackageBytes) throw new ArgumentOutOfRangeException(nameof(maximumBytes));
        await using var transaction = db.Database.CurrentTransaction is null
            ? await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken) : null;
        if (db.Database.CurrentTransaction!.GetDbTransaction().IsolationLevel is not (IsolationLevel.RepeatableRead or IsolationLevel.Serializable))
            throw new InvalidOperationException("Portable export requires a consistent snapshot transaction.");
        var snapshot = await db.Database.SqlQuery<SnapshotBoundary>($"SELECT transaction_timestamp() AS \"At\", pg_current_snapshot()::text AS \"Boundary\"").SingleAsync(cancellationToken);
        var boundary = Hash(Encoding.UTF8.GetBytes(snapshot.Boundary));
        var instanceId = await db.InstanceIdentities.AsNoTracking().Where(i => i.Key == 1).Select(i => i.InstanceId).SingleAsync(cancellationToken);
        var site = await db.Sites.AsNoTracking().SingleAsync(value => value.Id == siteId, cancellationToken);
        var units = await db.OrganizationUnits.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var unitIds = units.Select(value => value.Id).ToHashSet();
        var memberships = await db.SiteMemberships.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var unitMemberships = await db.OrganizationUnitMemberships.AsNoTracking().Where(value => unitIds.Contains(value.OrganizationUnitId)).ToListAsync(cancellationToken);
        var audit = await db.AuditEvents.AsNoTracking().Where(value => value.SiteId == siteId).OrderBy(value => value.OccurredAt).ToListAsync(cancellationToken);
        var workItems = await db.WorkItems.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var workItemIds = workItems.Select(value => value.Id).ToHashSet();
        var roles = await db.OrganizationRoles.AsNoTracking().Where(value => unitIds.Contains(value.OrganizationUnitId)).ToListAsync(cancellationToken);
        var roleIds = roles.Select(value => value.Id).ToHashSet();
        var roleAssignments = await db.RoleAssignments.AsNoTracking().Where(value => roleIds.Contains(value.RoleId)).ToListAsync(cancellationToken);
        var definitions = await db.WorkflowDefinitions.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var definitionIds = definitions.Select(value => value.Id).ToHashSet();
        var steps = await db.WorkflowSteps.AsNoTracking().Where(value => definitionIds.Contains(value.DefinitionId)).ToListAsync(cancellationToken);
        var runs = await db.WorkflowRuns.AsNoTracking().Where(value => workItemIds.Contains(value.WorkItemId)).ToListAsync(cancellationToken);
        var runIds = runs.Select(value => value.Id).ToHashSet();
        var executionRuns = await db.ExecutionRuns.AsNoTracking().Where(value => workItemIds.Contains(value.WorkItemId)).ToListAsync(cancellationToken);
        var executionRunIds = executionRuns.Select(value => value.Id).ToHashSet();
        var decisions = await db.Decisions.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var decisionIds = decisions.Select(value => value.Id).ToHashSet();
        var decisionRevisions = await db.DecisionRevisions.AsNoTracking().Where(value => decisionIds.Contains(value.DecisionId)).ToListAsync(cancellationToken);
        var decisionRevisionIds = decisionRevisions.Select(value => value.Id).ToHashSet();
        var risks = await db.Risks.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var riskIds = risks.Select(value => value.Id).ToHashSet();
        var mitigations = await db.RiskMitigations.AsNoTracking().Where(value => riskIds.Contains(value.RiskId)).ToListAsync(cancellationToken);
        var mitigationIds = mitigations.Select(value => value.Id).ToHashSet();
        var webhookSubscriptions = await db.WebhookSubscriptions.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var webhookSubscriptionIds = webhookSubscriptions.Select(value => value.Id).ToHashSet();
        var webhookDeliveries = await db.WebhookDeliveries.AsNoTracking().Where(value => webhookSubscriptionIds.Contains(value.SubscriptionId)).ToListAsync(cancellationToken);
        var webhookDeliveryIds = webhookDeliveries.Select(value => value.Id).ToHashSet();
        var approvedVersions = await db.DomainObjectVersions.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var approvedVersionIds = approvedVersions.Select(value => value.Id).ToHashSet();
        var approvalSignoffs = await db.FormalApprovalSignoffs.AsNoTracking().Where(value => approvedVersionIds.Contains(value.VersionId)).ToListAsync(cancellationToken);

        var lessons = await db.LearningLessons.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var learningEntries = await db.LearningEntries.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var comments = await db.WorkItemComments.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken);
        var personIds = webhookSubscriptions.Select(s => s.CreatedByPersonId).ToHashSet(); personIds.Add(actorPersonId);
        var datasets = new List<(string Name, byte[] Content)>();
        void Entities<T>(string name, IEnumerable<T> rows) where T : class
        {
            var values = rows.ToArray();
            var properties = db.Model.FindEntityType(typeof(T))!.GetProperties().Where(p => (p.Name.EndsWith("PersonId", StringComparison.Ordinal) || p.Name == "UpdatedBy") && p.PropertyInfo is not null);
            foreach (var row in values) foreach (var property in properties)
                if (property.PropertyInfo!.GetValue(row) is Guid personId) personIds.Add(personId);
            AddEntities(datasets, db, name, values, maximumBytes);
        }

        Entities("site", [site]);
        Entities("site-reference-settings", await db.SiteReferenceSettings.AsNoTracking().Where(s => s.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("organization-units", units);
        Entities("site-memberships", memberships);
        Entities("organization-unit-memberships", unitMemberships);
        Entities("site-manager-assignments", await db.SiteManagerAssignments.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("organization-roles", roles);
        Entities("role-assignments", roleAssignments);
        Entities("work-item-types", await db.WorkItemTypes.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("work-item-lookups", await db.WorkItemLookups.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("work-items", workItems);
        Entities("work-item-comments", comments);
        Entities("learning-lessons", lessons);
        Entities("learning-entries", learningEntries);
        Entities("work-item-dependencies", await db.WorkItemDependencies.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("work-item-history", await db.WorkItemStateHistory.AsNoTracking().Where(value => value.SiteId == siteId).OrderBy(value => value.OccurredAt).ToListAsync(cancellationToken));
        Entities("workflow-definitions", definitions);
        Entities("workflow-steps", steps);
        Entities("workflow-step-templates", await db.WorkflowStepTemplates.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("workflow-runs", runs);
        Entities("planning-rfi-entries", await db.PlanningRfiEntries.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("workflow-plan-allocations", await db.WorkflowPlanAllocations.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("workflow-plan-requests", await db.WorkflowPlanRequests.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("workflow-step-documents", await db.WorkflowStepDocuments.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("workflow-step-links", await db.WorkflowStepLinks.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("workflow-timeline-events", await db.WorkflowTimelineEvents.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("execution-runs", executionRuns);
        Entities("execution-step-documents", await db.ExecutionStepDocuments.AsNoTracking().Where(value => executionRunIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("execution-follow-up", await db.ExecutionExternalRequests.AsNoTracking().Where(value => executionRunIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("execution-timeline-events", await db.ExecutionTimelineEvents.AsNoTracking().Where(value => executionRunIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        Entities("decisions", decisions);
        Entities("decision-revisions", decisionRevisions);
        Entities("decision-makers", await db.DecisionMakers.AsNoTracking().Where(value => decisionRevisionIds.Contains(value.RevisionId)).ToListAsync(cancellationToken));
        Entities("decision-references", await db.DecisionReferences.AsNoTracking().Where(value => decisionRevisionIds.Contains(value.RevisionId)).ToListAsync(cancellationToken));
        Entities("risks", risks);
        Entities("risk-revisions", await db.RiskRevisions.AsNoTracking().Where(value => riskIds.Contains(value.RiskId)).ToListAsync(cancellationToken));
        Entities("risk-mitigations", mitigations);
        Entities("risk-mitigation-revisions", await db.RiskMitigationRevisions.AsNoTracking().Where(value => mitigationIds.Contains(value.MitigationId)).ToListAsync(cancellationToken));
        Entities("domain-object-versions", approvedVersions);
        Entities("formal-approval-signoffs", approvalSignoffs);
        var now = snapshot.At;
        var exportId = Guid.NewGuid();
        var exportAudit = new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "portability.export-created", "portable-export", exportId, now);
        exportAudit.SnapshotActorRole(await db.LoginIdentities.AsNoTracking().AnyAsync(i => i.PersonId == actorPersonId && i.IsPlatformManager, cancellationToken));
        audit.Add(exportAudit);
        Entities("audit-events", audit);
        Entities("machine-audit-events", await db.ApiMachineAuditEvents.AsNoTracking().Where(a => a.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("domain-events", await db.DomainEvents.AsNoTracking().Where(value => value.SiteId == siteId).OrderBy(value => value.OccurredAt).ToListAsync(cancellationToken));
        AddRows(datasets, "webhook-subscriptions", webhookSubscriptions.Select(value => new
        {
            value.Id,
            value.SiteId,
            value.Name,
            value.EndpointUrl,
            value.EventTypes,
            value.CreatedByPersonId,
            value.CreatedAt,
            value.UpdatedAt,
            value.IsActive,
            signingSecretIncluded = false
        }));
        Entities("webhook-deliveries", webhookDeliveries);
        Entities("webhook-delivery-attempts", await db.WebhookDeliveryAttempts.AsNoTracking().Where(value => webhookDeliveryIds.Contains(value.DeliveryId)).ToListAsync(cancellationToken));
        Entities("site-notification-settings", await db.SiteNotificationSettings.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("personal-notification-settings", await db.PersonalNotificationSettings.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("notification-outbox", await db.NotificationOutboxMessages.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));

        var lifecycles = await db.InformationLifecycles.AsNoTracking().Where(l => l.OwnerSiteId == siteId).ToListAsync(cancellationToken);
        var lifecycleIds = lifecycles.Select(l => l.Id).ToArray();
        Entities("information-lifecycle", lifecycles);
        Entities("lifecycle-holds", await db.LifecycleHolds.AsNoTracking().Where(h => lifecycleIds.Contains(h.LifecycleId)).ToListAsync(cancellationToken));
        var policyIds = lifecycles.Where(l => l.PolicyId != null).Select(l => l.PolicyId!.Value).ToArray();
        AddRows(datasets, "retention-policy-versions", (await db.RetentionPolicyVersions.AsNoTracking().Where(p => policyIds.Contains(p.PolicyId)).ToListAsync(cancellationToken)).Where(p => lifecycles.Any(l => l.PolicyId == p.PolicyId && l.PolicyVersion == p.Version)).Select(p => new { p.PolicyId, p.Version, p.Name, p.Category, p.ReviewAfterDays, p.CreatedAt }));
        Entities("archive-grants", await db.ArchiveGrants.AsNoTracking().Where(g => g.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("export-receipts", await db.ExportReceipts.AsNoTracking().Where(r => r.SiteId == siteId).ToListAsync(cancellationToken));
        Entities("event-projections", await db.EventProjections.AsNoTracking().Where(p => db.DomainEvents.Any(e => e.Id == p.DomainEventId && e.SiteId == siteId)).ToListAsync(cancellationToken));
        Entities("federation-work-links", await db.FederationWorkLinks.AsNoTracking().Where(l => workItemIds.Contains(l.LocalWorkItemId)).ToListAsync(cancellationToken));
        Entities("federation-inbound-receipts", await db.FederationInboundReceipts.AsNoTracking().Where(r => r.DestinationSiteId == siteId && workItemIds.Contains(r.LocalWorkItemId)).ToListAsync(cancellationToken));
        AddRows(datasets, "federation-outbound-evidence", await db.FederationOutboundMessages.AsNoTracking().Where(m => m.SourceSiteId == siteId).Select(m => new { m.MessageId, m.PeerInstanceId, m.SourceSiteId, m.DestinationSiteId, m.OriginInstanceId, m.OriginSiteId, m.OriginResourceId, m.MessageType, m.SchemaVersion, m.CorrelationId, m.CausationId, m.Status, m.CreatedAt, m.DeliveredAt }).ToListAsync(cancellationToken));
        var people = await db.People.AsNoTracking().Where(p => personIds.Contains(p.Id)).ToListAsync(cancellationToken);
        AddRows(datasets, "people", people.Select(p => (object)new { p.Id, p.DisplayName, p.Email, p.IsActive, p.IsDeleted, p.DeletedAt, p.ProfileImageContentType, p.CreatedAt }).Concat(personIds.Except(people.Select(p => p.Id)).Select(id => (object)new { id, historicalReferenceOnly = true, isActive = false, isDeleted = true })));
        AddRows(datasets, "identity-references", people.Select(p => new { personId = p.Id, authenticationSecretsIncluded = false }));
        AddRows(datasets, "external-identity-links", Array.Empty<object>());
        AddRows(datasets, "person-lifecycle-references", await db.InformationLifecycles.AsNoTracking().Where(l => l.OwnerSiteId == null && l.ResourceType == "person" && personIds.Contains(l.ResourceId)).Select(l => new { personId = l.ResourceId, l.Stage, l.Version, l.ClosedAt, l.ArchivedAt }).ToListAsync(cancellationToken));

        var attachments = new List<(PortableAttachmentDescriptor Descriptor, byte[] Content)>();
        foreach (var person in people.Where(value => value.ProfileImage is { Length: > 0 }))
        {
            var extension = person.ProfileImageContentType switch { "image/png" => "png", "image/jpeg" => "jpg", "image/webp" => "webp", _ => "bin" };
            var path = $"attachments/profile-images/{person.Id:N}.{extension}";
            attachments.Add((new PortableAttachmentDescriptor(path, person.ProfileImageContentType ?? "application/octet-stream", person.ProfileImage!.LongLength, Hash(person.ProfileImage), "person", person.Id), person.ProfileImage));
        }
        if (datasets.Count + attachments.Count + 2 > MaximumEntries) throw new PortablePackageTooLargeException();
        if (datasets.Sum(value => value.Content.LongLength) + attachments.Sum(value => value.Content.LongLength) > maximumBytes)
            throw new PortablePackageTooLargeException();

        using var package = new MemoryStream();
        using (var archive = new ZipArchive(package, ZipArchiveMode.Create, true, Encoding.UTF8))
        {
            var descriptors = new List<PortableDatasetDescriptor>();
            foreach (var dataset in datasets)
            {
                var path = $"data/{dataset.Name}.jsonl";
                WriteEntry(archive, path, dataset.Content);
                descriptors.Add(new PortableDatasetDescriptor(dataset.Name, path, "application/x-ndjson", CountLines(dataset.Content), dataset.Content.LongLength, Hash(dataset.Content)));
            }
            foreach (var attachment in attachments) WriteEntry(archive, attachment.Descriptor.Path, attachment.Content);
            var manifest = new PortableExportManifest(
                Format,
                FormatVersion,
                exportId,
                typeof(Program).Assembly.GetName().Version?.ToString(3) ?? "unknown",
                now,
                new PortableSiteDescriptor(site.Id, site.Name),
                "site",
                "SHA-256",
                descriptors,
                attachments.Select(value => value.Descriptor).ToArray(),
                ["Password hashes, MFA/TOTP secrets, recovery codes, passkeys, active sessions, reset grants, identity-provider configuration and secrets, webhook signing secrets and SMTP credentials are never exported.", "Installation-wide identity bindings, foreign private records and outbound federation payloads are excluded; external document links are not downloaded."],
                new PortableSnapshotDescriptor(instanceId, snapshot.At, boundary));
            WriteEntry(archive, "manifest.json", JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOptions));
            WriteEntry(archive, "README.txt", Encoding.UTF8.GetBytes(Readme));
        }
        var content = package.ToArray();
        if (content.LongLength > maximumBytes) throw new PortablePackageTooLargeException();
        using (var validationStream = new MemoryStream(content, false))
        {
            var validation = await PortableImportValidator.Validate(validationStream, siteId, cancellationToken);
            if (!validation.Valid) throw new PortableExportIntegrityException();
        }
        db.AuditEvents.Add(exportAudit);
        db.ExportReceipts.Add(new ExportReceipt(exportId, siteId, actorPersonId, snapshot.At, boundary, Hash(content), content.LongLength, lifecycles.FirstOrDefault(l => l.ResourceType == "site" && l.ResourceId == siteId)?.Version ?? 0));
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return content;
    }

    private static void AddEntities<TEntity>(List<(string Name, byte[] Content)> target, FylkrenDbContext db, string name, IEnumerable<TEntity> values, long maximumBytes) where TEntity : class
    {
        var type = db.Model.FindEntityType(typeof(TEntity)) ?? throw new InvalidOperationException($"Export metadata is missing for {typeof(TEntity).Name}.");
        var properties = type.GetProperties().Where(value => !value.IsShadowProperty() && value.PropertyInfo is not null && value.ClrType != typeof(byte[])).ToArray();
        var rows = values.Select(value => properties.ToDictionary(
            property => JsonNamingPolicy.SnakeCaseLower.ConvertName(property.Name),
            property => property.PropertyInfo!.GetValue(value)));
        AddRows(target, name, rows, maximumBytes);
    }

    private static void AddRows<T>(List<(string Name, byte[] Content)> target, string name, IEnumerable<T> rows, long maximumBytes = MaximumPackageBytes)
    {
        using var stream = new MemoryStream();
        var remaining = maximumBytes - target.Sum(d => d.Content.LongLength);
        foreach (var row in rows)
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(row, RowJsonOptions);
            if (stream.Length + bytes.LongLength + 1 > remaining) throw new PortablePackageTooLargeException();
            stream.Write(bytes); stream.WriteByte((byte)'\n');
        }
        target.Add((name, stream.ToArray()));
    }

    private static void WriteEntry(ZipArchive archive, string path, byte[] content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        using var destination = entry.Open();
        destination.Write(content);
    }

    internal static string Hash(byte[] content) => Convert.ToHexStringLower(SHA256.HashData(content));
    private static int CountLines(byte[] content) => content.Count(value => value == (byte)'\n');

    private sealed record SnapshotBoundary(DateTimeOffset At, string Boundary);

    private const string Readme = """
        Fylkren portable export package

        This ZIP file uses open formats. manifest.json describes the package, format version,
        site scope, datasets, attachments and SHA-256 integrity values. Structured records are
        UTF-8 JSON Lines in data/. Every line is one independent JSON object. Binary files retain
        their original format under attachments/. No running Fylkren installation is required to
        read the package.

        This is a portability/customer-exit export, not an installation backup. It deliberately
        excludes authentication and infrastructure secrets. See the repository documentation for
        the complete format and migration rules.
        """;
}

internal sealed class PortablePackageTooLargeException : Exception
{
}

internal sealed class PortableExportIntegrityException : Exception { }
