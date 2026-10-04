using Fylkren.Api.Federation;

internal static class InputValidationTests
{
    internal static void Run()
    {
        var baseline = new FederationCapabilityRequest(
            Guid.NewGuid(), Guid.NewGuid(), 1, 1, [1], ["assignment.created"],
            DateTimeOffset.UtcNow.ToUnixTimeSeconds(), Guid.NewGuid(), "synthetic");
        Require(FederationCapabilityProtocol.ValidOffer(baseline), "Valid capability offer was rejected.");
        Require(!FederationCapabilityProtocol.ValidOffer(baseline with { WorkSchemaVersions = null! }),
            "Null capability schema collection was accepted.");
        Require(!FederationCapabilityProtocol.ValidOffer(baseline with { WorkMessageTypes = null! }),
            "Null capability type collection was accepted.");
        Require(!FederationCapabilityProtocol.ValidOffer(baseline with { WorkMessageTypes = ["assignment.created", null!] }),
            "Null capability type element failed unsafely or was accepted.");
        Console.WriteLine("Input validation tests passed: capability collection and element boundaries.");
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
}
