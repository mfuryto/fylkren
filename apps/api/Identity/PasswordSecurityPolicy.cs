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
    private readonly byte[] breachedPasswordFingerprints;

    public PasswordSecurityPolicy()
    {
        commonPasswordFingerprints = LoadFingerprints("common-passwords.sha256");
        breachedPasswordFingerprints = LoadFingerprints("breached-passwords.sha256");
    }

    public string? Validate(string? password, params string?[] contextualValues)
    {
        if (password?.Length is not (>= MinimumLength and <= MaximumLength))
            return $"The password must be between {MinimumLength} and {MaximumLength} characters.";

        var normalizedPassword = Normalize(password);
        var fingerprint = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedPassword));
        if (ContainsFingerprint(commonPasswordFingerprints, fingerprint) ||
            ContainsFingerprint(breachedPasswordFingerprints, fingerprint))
            return "Choose a password that is not common or known from a data breach.";

        foreach (var token in ContextTokens(contextualValues.Prepend("Fylkren")))
        {
            if (normalizedPassword.Contains(token, StringComparison.Ordinal))
                return "The password cannot contain Fylkren, the username, display name, or email-address tokens.";
        }

        return null;
    }

    private static byte[] LoadFingerprints(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"Fylkren.Api.Security.{name}")
            ?? throw new InvalidOperationException($"The bundled {name} blocklist is missing.");
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        var fingerprints = memory.ToArray();
        if (fingerprints.Length == 0 || fingerprints.Length % FingerprintLength != 0)
            throw new InvalidOperationException($"The bundled {name} blocklist is invalid.");
        return fingerprints;
    }

    private static bool ContainsFingerprint(byte[] fingerprints, ReadOnlySpan<byte> fingerprint)
    {
        var low = 0;
        var high = fingerprints.Length / FingerprintLength - 1;
        while (low <= high)
        {
            var middle = low + ((high - low) / 2);
            var candidate = fingerprints.AsSpan(middle * FingerprintLength, FingerprintLength);
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
