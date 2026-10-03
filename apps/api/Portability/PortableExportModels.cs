namespace Fylkren.Api.Portability;

internal sealed record PortableExportManifest(
    string Format,
    string FormatVersion,
    Guid ExportId,
    string ApplicationVersion,
    DateTimeOffset ExportedAt,
    PortableSiteDescriptor Site,
    string Scope,
    string IntegrityAlgorithm,
    IReadOnlyList<PortableDatasetDescriptor> Datasets,
    IReadOnlyList<PortableAttachmentDescriptor> Attachments,
    IReadOnlyList<string> Exclusions,
    PortableSnapshotDescriptor? Snapshot = null);

internal sealed record PortableSnapshotDescriptor(Guid InstanceId, DateTimeOffset CapturedAt, string Boundary);

internal sealed record PortableSiteDescriptor(Guid Id, string Name);

internal sealed record PortableDatasetDescriptor(
    string Name,
    string Path,
    string MediaType,
    int RecordCount,
    long Bytes,
    string Sha256);

internal sealed record PortableAttachmentDescriptor(
    string Path,
    string MediaType,
    long Bytes,
    string Sha256,
    string OwnerType,
    Guid OwnerId);

internal sealed record PortablePackageValidationResult(
    bool Valid,
    string Format,
    string FormatVersion,
    Guid ExportId,
    Guid SiteId,
    string SiteName,
    int DatasetCount,
    int AttachmentCount,
    long UncompressedBytes,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings);
