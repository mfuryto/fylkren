namespace Fylkren.Api.Federation;

internal static class FederationSignatureProtocol
{
    internal const string CurrentAlgorithm = "ecdsa-p256-sha256-p1363";

    internal static bool IsSupported(string? algorithm) =>
        algorithm is null or CurrentAlgorithm;

    internal static string Purpose(string legacyPurpose, string? algorithm) =>
        algorithm is null ? legacyPurpose : legacyPurpose[..^2] + "v2";

    internal static IEnumerable<string> Bind(string? algorithm) =>
        algorithm is null ? [] : [algorithm];

    internal static bool Accepts(string? negotiatedAlgorithm, string? algorithm) =>
        negotiatedAlgorithm is null ? algorithm is null :
        negotiatedAlgorithm == algorithm && algorithm == CurrentAlgorithm;
}
