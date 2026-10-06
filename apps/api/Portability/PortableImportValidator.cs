using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;

namespace Fylkren.Api.Portability;

internal static class PortableImportValidator
{
    internal static async Task<PortablePackageValidationResult> Validate(
        Stream packageStream,
        Guid expectedSiteId,
        CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        try
        {
            using var archive = new ZipArchive(packageStream, ZipArchiveMode.Read, true);
            if (archive.Entries.Count > PortableExportPackage.MaximumEntries)
                return Invalid(errors, $"The package contains more than {PortableExportPackage.MaximumEntries} files.");
            long totalBytes = 0;
            foreach (var entry in archive.Entries)
            {
                // Untrusted ZIP64 lengths must pass the policy bound before addition or opening entries.
                if (entry.Length < 0 || entry.Length > PortableExportPackage.MaximumPackageBytes - totalBytes)
                    return Invalid(errors, "The package's extracted size exceeds 16 MiB.");
                totalBytes += entry.Length;
            }
            foreach (var entry in archive.Entries)
            {
                if (entry.FullName.Contains("..", StringComparison.Ordinal) || entry.FullName.StartsWith('/') || entry.FullName.StartsWith('\\'))
                    errors.Add($"Invalid file path in the package: {entry.FullName}");
            }
            foreach (var duplicate in archive.Entries.GroupBy(value => value.FullName, StringComparer.Ordinal).Where(group => group.Count() > 1))
                errors.Add($"The ZIP package contains a duplicate path: {duplicate.Key}");
            if (errors.Count > 0) return Invalid(errors, "The archive structure or size is invalid.");

            var manifestEntry = archive.GetEntry("manifest.json");
            if (manifestEntry is null)
                return Invalid(errors, "The package is missing manifest.json.");
            PortableExportManifest? manifest;
            await using (var manifestStream = manifestEntry.Open())
                manifest = await JsonSerializer.DeserializeAsync<PortableExportManifest>(manifestStream, new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken);
            if (manifest is null || !HasValidShape(manifest)) return Invalid(errors, "The manifest structure or field limits are invalid.");
            if (manifest.Format != PortableExportPackage.Format) errors.Add("The package is not a Fylkren portability format.");
            if (manifest.FormatVersion is not ("1.0" or "1.1")) errors.Add($"Format version {manifest.FormatVersion} is not supported by this installation.");
            if (manifest.FormatVersion == "1.0") warnings.Add("Legacy format 1.0 lacks snapshot/lifecycle/export custody evidence and does not establish restoration readiness.");
            if (manifest.FormatVersion == "1.1" && (manifest.Snapshot is null || manifest.Snapshot.InstanceId == Guid.Empty || manifest.Snapshot.CapturedAt != manifest.ExportedAt || manifest.Snapshot.Boundary is not { Length: 64 } || !manifest.Snapshot.Boundary.All(Uri.IsHexDigit))) errors.Add("Format 1.1 requires a valid consistent snapshot descriptor.");
            if (manifest.Datasets.Select(d => d.Name).Distinct(StringComparer.Ordinal).Count() != manifest.Datasets.Count) errors.Add("Dataset names must be unique.");
            if (manifest.Scope != "site") errors.Add("Only site-scoped packages are supported.");
            if (manifest.Site.Id != expectedSiteId) errors.Add("The package belongs to another site. Import across site boundaries is blocked.");
            if (!string.Equals(manifest.IntegrityAlgorithm, "SHA-256", StringComparison.OrdinalIgnoreCase)) errors.Add("The package uses an unknown integrity algorithm.");

            var declaredPaths = new HashSet<string>(StringComparer.Ordinal);
            var inspections = new Dictionary<string, DatasetInspection>(StringComparer.Ordinal);
            foreach (var dataset in manifest.Datasets)
            {
                if (!declaredPaths.Add(dataset.Path)) { errors.Add($"Duplicate file in the manifest: {dataset.Path}"); continue; }
                if (!dataset.Path.StartsWith("data/", StringComparison.Ordinal) || !dataset.Path.EndsWith(".jsonl", StringComparison.Ordinal))
                {
                    errors.Add($"Invalid dataset path: {dataset.Path}");
                    continue;
                }
                if (!string.Equals(dataset.MediaType, "application/x-ndjson", StringComparison.Ordinal))
                {
                    errors.Add($"Invalid dataset media type for {dataset.Path}.");
                    continue;
                }
                var entry = archive.GetEntry(dataset.Path);
                if (entry is null) { errors.Add($"Missing dataset: {dataset.Path}"); continue; }
                if (entry.Length != dataset.Bytes) errors.Add($"The file size does not match for {dataset.Path}.");
                var result = await InspectJsonLines(entry, expectedSiteId, dataset.Name, cancellationToken);
                inspections[dataset.Name] = result;
                if (!string.Equals(result.Hash, dataset.Sha256, StringComparison.OrdinalIgnoreCase)) errors.Add($"The integrity check failed for {dataset.Path}.");
                if (result.Count != dataset.RecordCount) errors.Add($"The record count does not match for {dataset.Path}.");
                errors.AddRange(result.Errors.Select(value => $"{dataset.Path}: {value}"));
            }
            ValidateDatasetStructure(inspections, expectedSiteId, manifest.FormatVersion, errors);

            foreach (var attachment in manifest.Attachments)
            {
                if (!declaredPaths.Add(attachment.Path)) { errors.Add($"Duplicate file in the manifest: {attachment.Path}"); continue; }
                if (!attachment.Path.StartsWith("attachments/", StringComparison.Ordinal)) { errors.Add($"Invalid attachment path: {attachment.Path}"); continue; }
                if (attachment.OwnerType != "person" || !inspections.TryGetValue("people", out var people) || !people.Ids.Contains(attachment.OwnerId)) errors.Add($"Attachment owner is missing or unsupported: {attachment.Path}.");
                var entry = archive.GetEntry(attachment.Path);
                if (entry is null) { errors.Add($"Missing attachment: {attachment.Path}"); continue; }
                await using var input = entry.Open();
                using var content = new MemoryStream(entry.Length <= int.MaxValue ? (int)entry.Length : 0);
                await input.CopyToAsync(content, cancellationToken);
                var bytes = content.ToArray();
                var hash = Convert.ToHexStringLower(SHA256.HashData(bytes));
                if (!string.Equals(hash, attachment.Sha256, StringComparison.OrdinalIgnoreCase)) errors.Add($"The integrity check failed for {attachment.Path}.");
                if (entry.Length != attachment.Bytes) errors.Add($"The file size does not match for {attachment.Path}.");
                if (SafeImageUpload.Sanitize(bytes, attachment.MediaType, attachment.Path) is null)
                    errors.Add($"The attachment type, extension or image content is invalid for {attachment.Path}.");
            }

            var undeclared = archive.Entries.Where(value => value.FullName is not "manifest.json" and not "README.txt" && !declaredPaths.Contains(value.FullName)).Select(value => value.FullName).ToArray();
            if (undeclared.Length > 0) warnings.Add($"The package contains {undeclared.Length} files that are not declared in the manifest.");
            warnings.Add("Validation does not change any data. A later explicit migration operation must handle identity links and any ID conflicts.");
            return new PortablePackageValidationResult(errors.Count == 0, manifest.Format, manifest.FormatVersion, manifest.ExportId, manifest.Site.Id, manifest.Site.Name, manifest.Datasets.Count, manifest.Attachments.Count, totalBytes, errors, warnings);
        }
        catch (InvalidDataException)
        {
            return Invalid(errors, "The file is not a valid ZIP package.");
        }
        catch (JsonException)
        {
            return Invalid(errors, "The package contains invalid JSON.");
        }
    }

    private static bool HasValidShape(PortableExportManifest manifest)
    {
        static bool Text(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 512;
        static bool Hash(string? value) => value is { Length: 64 } && value.All(Uri.IsHexDigit);
        return Text(manifest.Format) && Text(manifest.FormatVersion) && Text(manifest.ApplicationVersion) &&
            Text(manifest.Scope) && Text(manifest.IntegrityAlgorithm) && manifest.Site is not null && Text(manifest.Site.Name) &&
            manifest.Datasets is not null && manifest.Attachments is not null && manifest.Exclusions is not null &&
            manifest.Datasets.Count <= PortableExportPackage.MaximumEntries && manifest.Attachments.Count <= PortableExportPackage.MaximumEntries &&
            manifest.Exclusions.All(value => value is not null) &&
            manifest.Datasets.All(value => value is not null && Text(value.Name) && Text(value.Path) && Text(value.MediaType) && Hash(value.Sha256) &&
                value.RecordCount is >= 0 and <= 1_000_000 && value.Bytes >= 0 && value.Bytes <= PortableExportPackage.MaximumPackageBytes) &&
            manifest.Attachments.All(value => value is not null && Text(value.Path) && Text(value.MediaType) && Text(value.OwnerType) && Hash(value.Sha256) &&
                value.Bytes >= 0 && value.Bytes <= PortableExportPackage.MaximumPackageBytes);
    }

    private static async Task<DatasetInspection> InspectJsonLines(ZipArchiveEntry entry, Guid expectedSiteId, string datasetName, CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var count = 0;
        var ids = new HashSet<Guid>();
        var policyKeys = new HashSet<string>();
        var policyBindings = new HashSet<string>();
        var references = new Dictionary<string, List<Guid>>(StringComparer.Ordinal);
        await using var input = entry.Open();
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();
        using var reader = new StringReader(System.Text.Encoding.UTF8.GetString(bytes));
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            count++;
            if (count > 1_000_000) { errors.Add("The dataset contains more than one million records."); break; }
            using var document = JsonDocument.Parse(line);
            if (document.RootElement.ValueKind != JsonValueKind.Object) { errors.Add($"Record {count} is not a JSON object."); continue; }
            if (document.RootElement.TryGetProperty("id", out var idValue))
            {
                if (idValue.ValueKind != JsonValueKind.String || !Guid.TryParse(idValue.GetString(), out var id)) errors.Add($"Record {count} has an invalid ID.");
                else if (!ids.Add(id)) errors.Add($"Duplicate ID {id}.");
            }
            if (document.RootElement.TryGetProperty("site_id", out var siteValue) && siteValue.ValueKind == JsonValueKind.String && Guid.TryParse(siteValue.GetString(), out var siteId) && siteId != expectedSiteId)
                errors.Add($"Record {count} points to site {siteId} outside the import boundary.");
            var opaqueRequestProperty = datasetName == "domain-events" ? "request_id" : datasetName == "machine-audit-events" ? "correlation_id" : null;
            var requestLimit = datasetName == "machine-audit-events" ? 100 : 200;
            if (opaqueRequestProperty is not null && document.RootElement.TryGetProperty(opaqueRequestProperty, out var requestId) && requestId.ValueKind != JsonValueKind.Null &&
                (requestId.ValueKind != JsonValueKind.String || requestId.GetString()!.Length > requestLimit || requestId.GetString()!.Any(char.IsControl)))
                errors.Add($"Record {count} has an invalid request identifier.");
            if (document.RootElement.TryGetProperty("owner_site_id", out var owner) && owner.ValueKind != JsonValueKind.Null && (owner.ValueKind != JsonValueKind.String || !owner.TryGetGuid(out var ownerId) || ownerId != expectedSiteId))
                errors.Add($"Record {count} has a foreign lifecycle owner.");
            if (document.RootElement.TryGetProperty("policy_id", out var policyId) && policyId.ValueKind != JsonValueKind.Null)
            {
                var versionField = datasetName == "retention-policy-versions" ? "version" : "policy_version";
                if (policyId.ValueKind != JsonValueKind.String || !Guid.TryParse(policyId.GetString(), out var key) || !document.RootElement.TryGetProperty(versionField, out var policyVersion) || policyVersion.ValueKind != JsonValueKind.Number || !policyVersion.TryGetInt32(out var version) || version < 1)
                    errors.Add($"Record {count} has an invalid versioned policy reference.");
                else if (datasetName == "retention-policy-versions") { if (!policyKeys.Add($"{key:N}:{version}")) errors.Add("Duplicate policy version."); }
                else policyBindings.Add($"{key:N}:{version}");
            }
            if (datasetName == "information-lifecycle" && document.RootElement.TryGetProperty("policy_version", out var boundVersion) && boundVersion.ValueKind != JsonValueKind.Null && (!document.RootElement.TryGetProperty("policy_id", out var boundId) || boundId.ValueKind == JsonValueKind.Null)) errors.Add("A policy version requires its policy ID.");
            foreach (var property in document.RootElement.EnumerateObject().Where(value => value.Name != opaqueRequestProperty && value.Name.EndsWith("_id", StringComparison.Ordinal) && value.Value.ValueKind == JsonValueKind.String))
            {
                if (!Guid.TryParse(property.Value.GetString(), out var reference)) { errors.Add($"Record {count} has an invalid reference in {property.Name}."); continue; }
                if (!references.TryGetValue(property.Name, out var values)) references[property.Name] = values = [];
                values.Add(reference);
            }
        }
        return new DatasetInspection(PortableExportPackage.Hash(bytes), count, ids, references, errors, policyKeys, policyBindings);
    }

    private static void ValidateDatasetStructure(Dictionary<string, DatasetInspection> values, Guid expectedSiteId, string formatVersion, List<string> errors)
    {
        string[] required = ["site", "organization-units", "site-memberships", "people", "work-items", "work-item-history", "workflow-definitions", "workflow-steps", "workflow-runs", "execution-runs", "decisions", "decision-revisions", "risks", "risk-revisions", "audit-events"];
        foreach (var name in required.Where(name => !values.ContainsKey(name))) errors.Add($"Required dataset is missing: {name}.");
        if (formatVersion == "1.1")
        {
            string[] lifecycleSets = ["information-lifecycle", "lifecycle-holds", "retention-policy-versions", "archive-grants", "export-receipts", "event-projections", "domain-events", "federation-work-links", "federation-inbound-receipts", "federation-outbound-evidence", "person-lifecycle-references"];
            foreach (var name in lifecycleSets.Where(name => !values.ContainsKey(name))) errors.Add($"Required lifecycle dataset is missing: {name}.");
            if (values.TryGetValue("information-lifecycle", out var lifecycle) && values.TryGetValue("retention-policy-versions", out var policies) && !lifecycle.PolicyBindings.IsSubsetOf(policies.PolicyKeys)) errors.Add("A bound immutable policy version is missing.");
            Reference(values, errors, "lifecycle-holds", "lifecycle_id", "information-lifecycle");
            Reference(values, errors, "event-projections", "domain_event_id", "domain-events");
            Reference(values, errors, "federation-work-links", "local_work_item_id", "work-items");
            Reference(values, errors, "federation-inbound-receipts", "local_work_item_id", "work-items");
        }
        foreach (var dataset in values)
            foreach (var personReference in dataset.Value.References.Keys.Where(k => k.EndsWith("person_id", StringComparison.Ordinal)))
                Reference(values, errors, dataset.Key, personReference, "people");
        if (values.TryGetValue("site", out var site) && (site.Count != 1 || !site.Ids.Contains(expectedSiteId))) errors.Add("The site dataset must contain exactly the site covered by the package.");

        Reference(values, errors, "organization-unit-memberships", "organization_unit_id", "organization-units");
        Reference(values, errors, "organization-unit-memberships", "person_id", "people");
        Reference(values, errors, "site-memberships", "person_id", "people");
        Reference(values, errors, "site-manager-assignments", "person_id", "people");
        Reference(values, errors, "organization-roles", "organization_unit_id", "organization-units");
        Reference(values, errors, "role-assignments", "role_id", "organization-roles");
        Reference(values, errors, "role-assignments", "person_id", "people");
        Reference(values, errors, "identity-references", "person_id", "people");
        Reference(values, errors, "external-identity-links", "person_id", "people");
        Reference(values, errors, "work-items", "work_item_type_id", "work-item-types");
        Reference(values, errors, "work-items", "source_type_id", "work-item-lookups");
        Reference(values, errors, "work-items", "sender_id", "work-item-lookups");
        Reference(values, errors, "work-items", "assigned_unit_id", "organization-units");
        Reference(values, errors, "work-items", "created_by_person_id", "people");
        Reference(values, errors, "work-items", "created_by_machine_id", "api-machine-references");
        Reference(values, errors, "work-item-dependencies", "predecessor_work_item_id", "work-items");
        Reference(values, errors, "work-item-dependencies", "dependent_work_item_id", "work-items");
        Reference(values, errors, "work-item-comments", "work_item_id", "work-items");
        Reference(values, errors, "learning-lessons", "work_item_id", "work-items");
        Reference(values, errors, "learning-lessons", "unit_id", "organization-units");
        Reference(values, errors, "learning-lessons", "author_person_id", "people");
        Reference(values, errors, "learning-lessons", "owner_person_id", "people");
        Reference(values, errors, "learning-entries", "lesson_id", "learning-lessons");
        Reference(values, errors, "learning-entries", "author_person_id", "people");
        Reference(values, errors, "work-item-comments", "author_person_id", "people");
        Reference(values, errors, "work-item-comments", "author_machine_id", "api-machine-references");
        Reference(values, errors, "machine-audit-events", "machine_identity_id", "api-machine-references");
        Reference(values, errors, "domain-events", "actor_machine_id", "api-machine-references");
        Reference(values, errors, "work-item-history", "work_item_id", "work-items");
        Reference(values, errors, "workflow-steps", "definition_id", "workflow-definitions");
        Reference(values, errors, "workflow-steps", "template_id", "workflow-step-templates");
        Reference(values, errors, "workflow-runs", "work_item_id", "work-items");
        Reference(values, errors, "workflow-runs", "definition_id", "workflow-definitions");
        Reference(values, errors, "workflow-plan-allocations", "run_id", "workflow-runs");
        Reference(values, errors, "workflow-plan-allocations", "step_id", "workflow-steps");
        Reference(values, errors, "workflow-plan-requests", "run_id", "workflow-runs");
        Reference(values, errors, "workflow-plan-requests", "step_id", "workflow-steps");
        Reference(values, errors, "workflow-step-documents", "run_id", "workflow-runs");
        Reference(values, errors, "workflow-step-documents", "step_id", "workflow-steps");
        Reference(values, errors, "workflow-step-links", "run_id", "workflow-runs");
        Reference(values, errors, "workflow-step-links", "step_id", "workflow-steps");
        Reference(values, errors, "workflow-timeline-events", "run_id", "workflow-runs");
        Reference(values, errors, "workflow-timeline-events", "step_id", "workflow-steps");
        Reference(values, errors, "execution-runs", "work_item_id", "work-items");
        Reference(values, errors, "execution-runs", "definition_id", "workflow-definitions");
        Reference(values, errors, "execution-step-documents", "run_id", "execution-runs");
        Reference(values, errors, "execution-follow-up", "run_id", "execution-runs");
        Reference(values, errors, "execution-timeline-events", "run_id", "execution-runs");
        Reference(values, errors, "decision-revisions", "decision_id", "decisions");
        Reference(values, errors, "decisions", "created_by_person_id", "people");
        Reference(values, errors, "decision-revisions", "recorded_by_person_id", "people");
        Reference(values, errors, "decision-makers", "revision_id", "decision-revisions");
        Reference(values, errors, "decision-makers", "person_id", "people");
        Reference(values, errors, "decision-references", "revision_id", "decision-revisions");
        Reference(values, errors, "risk-revisions", "risk_id", "risks");
        Reference(values, errors, "risks", "created_by_person_id", "people");
        Reference(values, errors, "risk-revisions", "owner_person_id", "people");
        Reference(values, errors, "risk-revisions", "recorded_by_person_id", "people");
        Reference(values, errors, "risk-mitigations", "risk_id", "risks");
        Reference(values, errors, "risk-mitigations", "created_by_person_id", "people");
        Reference(values, errors, "risk-mitigation-revisions", "mitigation_id", "risk-mitigations");
        Reference(values, errors, "risk-mitigation-revisions", "owner_person_id", "people");
        Reference(values, errors, "risk-mitigation-revisions", "recorded_by_person_id", "people");
        Reference(values, errors, "webhook-subscriptions", "created_by_person_id", "people");
        Reference(values, errors, "webhook-deliveries", "subscription_id", "webhook-subscriptions");
        Reference(values, errors, "webhook-deliveries", "domain_event_id", "domain-events");
        Reference(values, errors, "webhook-delivery-attempts", "delivery_id", "webhook-deliveries");
    }

    private static void Reference(Dictionary<string, DatasetInspection> values, List<string> errors, string sourceName, string property, string targetName)
    {
        if (!values.TryGetValue(sourceName, out var source) || !values.TryGetValue(targetName, out var target) || !source.References.TryGetValue(property, out var references)) return;
        var missing = references.Where(value => !target.Ids.Contains(value)).Distinct().Take(5).ToArray();
        if (missing.Length > 0) errors.Add($"{sourceName}.{property} contains references missing from {targetName}: {string.Join(", ", missing)}.");
    }

    private static PortablePackageValidationResult Invalid(List<string> errors, string error)
    {
        errors.Add(error);
        return new PortablePackageValidationResult(false, "", "", Guid.Empty, Guid.Empty, "", 0, 0, 0, errors, []);
    }

    private sealed record DatasetInspection(string Hash, int Count, HashSet<Guid> Ids, Dictionary<string, List<Guid>> References, IReadOnlyList<string> Errors, HashSet<string> PolicyKeys, HashSet<string> PolicyBindings);
}
