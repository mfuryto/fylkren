using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace Fylkren.Api.Identity;

internal sealed class PasswordSecurityPolicy
{
    internal const int MinimumLength = 14;
    internal const int MaximumLength = 128;
    private const int FingerprintLength = 32;
    private readonly byte[] commonPasswordFingerprints;

    public PasswordSecurityPolicy()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Fylkren.Api.Security.common-passwords.sha256")
            ?? throw new InvalidOperationException("The bundled common-password blocklist is missing.");
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        commonPasswordFingerprints = memory.ToArray();
        if (commonPasswordFingerprints.Length == 0 || commonPasswordFingerprints.Length % FingerprintLength != 0)
            throw new InvalidOperationException("The bundled common-password blocklist is invalid.");
    }

    public string? Validate(string? password, params string?[] contextualValues)
    {
        if (password?.Length is not (>= MinimumLength and <= MaximumLength))
            return $"Passordet må være mellom {MinimumLength} og {MaximumLength} tegn.";

        var normalizedPassword = Normalize(password);
        if (ContainsFingerprint(SHA256.HashData(Encoding.UTF8.GetBytes(normalizedPassword))))
            return "Velg et mindre vanlig passord.";

        foreach (var token in ContextTokens(contextualValues.Prepend("Fylkren")))
        {
            if (normalizedPassword.Contains(token, StringComparison.Ordinal))
                return "Passordet kan ikke inneholde brukernavn, navn, e-postadresse, organisasjonsnavn eller produktnavn.";
        }

        return null;
    }

    private bool ContainsFingerprint(ReadOnlySpan<byte> fingerprint)
    {
        var low = 0;
        var high = commonPasswordFingerprints.Length / FingerprintLength - 1;
        while (low <= high)
        {
            var middle = low + ((high - low) / 2);
            var candidate = commonPasswordFingerprints.AsSpan(middle * FingerprintLength, FingerprintLength);
            var comparison = fingerprint.SequenceCompareTo(candidate);
            if (comparison == 0) return true;
            if (comparison < 0) high = middle - 1;
            else low = middle + 1;
        }
        return false;
    }

    private static string Normalize(string value) => value.Normalize(NormalizationForm.FormKC).ToLowerInvariant();

    private static IEnumerable<string> ContextTokens(IEnumerable<string?> values) => values
        .Where(value => !string.IsNullOrWhiteSpace(value))
        .SelectMany(value => Normalize(value!).Split(
            [' ', '.', ',', ';', ':', '@', '\\', '/', '-', '_', '+', '(', ')', '[', ']'],
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        .Where(value => value.Length >= 4)
        .Distinct(StringComparer.Ordinal);
}
