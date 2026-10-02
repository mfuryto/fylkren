using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Fylkren.Api.Portability;

internal static class PortableExportPackage
{
    internal const string Format = "fylkren-portable-export";
    internal const string FormatVersion = "1.0";
    internal const long MaximumPackageBytes = 512L * 1024 * 1024;
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
        CancellationToken cancellationToken)
    {
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
        var personIds = memberships.Select(value => value.PersonId)
            .Concat(unitMemberships.Select(value => value.PersonId))
            .Concat(roleAssignments.Select(value => value.PersonId))
            .Concat(audit.Where(value => value.ActorPersonId.HasValue).Select(value => value.ActorPersonId!.Value))
            .Concat(workItems.Where(value => value.CreatedByPersonId.HasValue).Select(value => value.CreatedByPersonId!.Value))
            .Concat(workItems.Where(value => value.FinalReportWrittenByPersonId != null).Select(value => value.FinalReportWrittenByPersonId!.Value))
            .Concat(workItems.Where(value => value.FinalReportApprovedByPersonId != null).Select(value => value.FinalReportApprovedByPersonId!.Value))
            .Concat(comments.Select(value => value.AuthorPersonId))
            .Concat(lessons.Select(value => value.AuthorPersonId))
            .Concat(lessons.Where(value => value.OwnerPersonId != null).Select(value => value.OwnerPersonId!.Value))
            .Concat(learningEntries.Select(value => value.AuthorPersonId))
            .Concat(decisions.Select(value => value.CreatedByPersonId))
            .Concat(webhookSubscriptions.Select(value => value.CreatedByPersonId))
            .Concat(approvedVersions.Select(value => value.CreatedByPersonId))
            .Concat(approvalSignoffs.Select(value => value.ApproverPersonId))
            .ToHashSet();
        var people = await db.People.AsNoTracking().Where(value => personIds.Contains(value.Id)).ToListAsync(cancellationToken);

        var datasets = new List<(string Name, byte[] Content)>();
        AddEntities(datasets, db, "site", [site]);
        AddEntities(datasets, db, "organization-units", units);
        AddEntities(datasets, db, "site-memberships", memberships);
        AddEntities(datasets, db, "organization-unit-memberships", unitMemberships);
        AddEntities(datasets, db, "site-manager-assignments", await db.SiteManagerAssignments.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "organization-roles", roles);
        AddEntities(datasets, db, "role-assignments", roleAssignments);
        AddRows(datasets, "people", people.Select(value => new
        {
            value.Id,
            value.DisplayName,
            value.Email,
            value.IsActive,
            value.IsDeleted,
            value.DeletedAt,
            value.ProfileImageContentType,
            value.CreatedAt
        }));
        AddRows(datasets, "identity-references", await db.LoginIdentities.AsNoTracking().Where(value => personIds.Contains(value.PersonId)).Select(value => new
        {
            value.Id,
            value.PersonId,
            value.Username,
            value.IsActive,
            value.CreatedAt,
            value.LastSignedInAt,
            authenticationSecretsIncluded = false
        }).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "external-identity-links", await db.ExternalIdentityLinks.AsNoTracking().Where(value => personIds.Contains(value.PersonId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "work-item-types", await db.WorkItemTypes.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "work-item-lookups", await db.WorkItemLookups.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "work-items", workItems);
        AddEntities(datasets, db, "work-item-comments", comments);
        AddEntities(datasets, db, "learning-lessons", lessons);
        AddEntities(datasets, db, "learning-entries", learningEntries);
        AddEntities(datasets, db, "work-item-dependencies", await db.WorkItemDependencies.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "work-item-history", await db.WorkItemStateHistory.AsNoTracking().Where(value => value.SiteId == siteId).OrderBy(value => value.OccurredAt).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-definitions", definitions);
        AddEntities(datasets, db, "workflow-steps", steps);
        AddEntities(datasets, db, "workflow-step-templates", await db.WorkflowStepTemplates.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-runs", runs);
        AddEntities(datasets, db, "planning-rfi-entries", await db.PlanningRfiEntries.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-plan-allocations", await db.WorkflowPlanAllocations.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-plan-requests", await db.WorkflowPlanRequests.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-step-documents", await db.WorkflowStepDocuments.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-step-links", await db.WorkflowStepLinks.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "workflow-timeline-events", await db.WorkflowTimelineEvents.AsNoTracking().Where(value => runIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "execution-runs", executionRuns);
        AddEntities(datasets, db, "execution-step-documents", await db.ExecutionStepDocuments.AsNoTracking().Where(value => executionRunIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "execution-follow-up", await db.ExecutionExternalRequests.AsNoTracking().Where(value => executionRunIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "execution-timeline-events", await db.ExecutionTimelineEvents.AsNoTracking().Where(value => executionRunIds.Contains(value.RunId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "decisions", decisions);
        AddEntities(datasets, db, "decision-revisions", decisionRevisions);
        AddEntities(datasets, db, "decision-makers", await db.DecisionMakers.AsNoTracking().Where(value => decisionRevisionIds.Contains(value.RevisionId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "decision-references", await db.DecisionReferences.AsNoTracking().Where(value => decisionRevisionIds.Contains(value.RevisionId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "risks", risks);
        AddEntities(datasets, db, "risk-revisions", await db.RiskRevisions.AsNoTracking().Where(value => riskIds.Contains(value.RiskId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "risk-mitigations", mitigations);
        AddEntities(datasets, db, "risk-mitigation-revisions", await db.RiskMitigationRevisions.AsNoTracking().Where(value => mitigationIds.Contains(value.MitigationId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "domain-object-versions", approvedVersions);
        AddEntities(datasets, db, "formal-approval-signoffs", approvalSignoffs);
        var now = DateTimeOffset.UtcNow;
        var exportId = Guid.NewGuid();
        var exportAudit = new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "portability.export-created", "portable-export", exportId, now);
        db.AuditEvents.Add(exportAudit);
        audit.Add(exportAudit);
        await db.SaveChangesAsync(cancellationToken);
        AddEntities(datasets, db, "audit-events", audit);
        AddEntities(datasets, db, "domain-events", await db.DomainEvents.AsNoTracking().Where(value => value.SiteId == siteId).OrderBy(value => value.OccurredAt).ToListAsync(cancellationToken));
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
        AddEntities(datasets, db, "webhook-deliveries", webhookDeliveries);
        AddEntities(datasets, db, "webhook-delivery-attempts", await db.WebhookDeliveryAttempts.AsNoTracking().Where(value => webhookDeliveryIds.Contains(value.DeliveryId)).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "site-notification-settings", await db.SiteNotificationSettings.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "personal-notification-settings", await db.PersonalNotificationSettings.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));
        AddEntities(datasets, db, "notification-outbox", await db.NotificationOutboxMessages.AsNoTracking().Where(value => value.SiteId == siteId).ToListAsync(cancellationToken));

        var attachments = new List<(PortableAttachmentDescriptor Descriptor, byte[] Content)>();
        foreach (var person in people.Where(value => value.ProfileImage is { Length: > 0 }))
        {
            var extension = person.ProfileImageContentType switch { "image/png" => "png", "image/jpeg" => "jpg", "image/webp" => "webp", _ => "bin" };
            var path = $"attachments/profile-images/{person.Id:N}.{extension}";
            attachments.Add((new PortableAttachmentDescriptor(path, person.ProfileImageContentType ?? "application/octet-stream", person.ProfileImage!.LongLength, Hash(person.ProfileImage), "person", person.Id), person.ProfileImage));
        }
        if (datasets.Sum(value => value.Content.LongLength) + attachments.Sum(value => value.Content.LongLength) > MaximumPackageBytes)
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
                ["Password hashes, MFA/TOTP secrets, recovery codes, passkeys, active sessions, reset grants, identity-provider configuration and secrets, webhook signing secrets and SMTP credentials are never exported."]);
            WriteEntry(archive, "manifest.json", JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOptions));
            WriteEntry(archive, "README.txt", Encoding.UTF8.GetBytes(Readme));
        }
        return package.ToArray();
    }

    private static void AddEntities<TEntity>(List<(string Name, byte[] Content)> target, FylkrenDbContext db, string name, IEnumerable<TEntity> values) where TEntity : class
    {
        var type = db.Model.FindEntityType(typeof(TEntity)) ?? throw new InvalidOperationException($"Export metadata is missing for {typeof(TEntity).Name}.");
        var properties = type.GetProperties().Where(value => !value.IsShadowProperty() && value.PropertyInfo is not null && value.ClrType != typeof(byte[])).ToArray();
        var rows = values.Select(value => properties.ToDictionary(
            property => JsonNamingPolicy.SnakeCaseLower.ConvertName(property.Name),
            property => property.PropertyInfo!.GetValue(value)));
        AddRows(target, name, rows);
    }

    private static void AddRows<T>(List<(string Name, byte[] Content)> target, string name, IEnumerable<T> rows)
    {
        using var stream = new MemoryStream();
        foreach (var row in rows)
        {
            JsonSerializer.Serialize(stream, row, RowJsonOptions);
            stream.WriteByte((byte)'\n');
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
