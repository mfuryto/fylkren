namespace Fylkren.Api.Licensing;

// This is the single allocation table for the 1.0 distribution. Changing a feature's
// edition does not change the database schema or create another implementation.
internal static class FeatureCatalog
{
    internal const string MachineApi = "machine-api";
    internal const string Webhooks = "webhooks";
    internal const string ExternalIdentity = "external-identity";
    internal const string InstanceFederation = "instance-federation";

    internal static readonly IReadOnlySet<string> Enterprise = new HashSet<string>(StringComparer.Ordinal)
    {
        MachineApi, Webhooks, ExternalIdentity, InstanceFederation
    };

    internal static bool IsKnown(string feature) => Enterprise.Contains(feature);
}
