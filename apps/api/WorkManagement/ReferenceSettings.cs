using System.Text;

namespace Fylkren.Api.WorkManagement;

public sealed class PlatformReferenceSettings
{
    private PlatformReferenceSettings() { }

    public PlatformReferenceSettings(int minimumDigits, long nextNumber, DateTimeOffset updatedAt, Guid? updatedBy)
    {
        Key = 1;
        NextNumber = nextNumber;
        Update(minimumDigits, nextNumber, updatedAt, updatedBy);
    }

    public int Key { get; private set; }
    public int MinimumDigits { get; private set; }
    public long NextNumber { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public void Update(int minimumDigits, long nextNumber, DateTimeOffset updatedAt, Guid? updatedBy)
    {
        if (minimumDigits is < 3 or > 10)
            throw new ArgumentOutOfRangeException(nameof(minimumDigits));
        if (nextNumber < NextNumber || nextNumber is < 1 or > 9_999_999_999)
            throw new ArgumentOutOfRangeException(nameof(nextNumber));
        MinimumDigits = minimumDigits;
        NextNumber = nextNumber;
        UpdatedAt = updatedAt;
        UpdatedBy = updatedBy;
    }

    internal long Reserve()
    {
        if (NextNumber > 9_999_999_999) throw new InvalidOperationException("The task reference range is exhausted.");
        return NextNumber++;
    }
}

public sealed class SiteReferenceSettings
{
    private SiteReferenceSettings() { }

    public SiteReferenceSettings(Guid siteId, string prefix,
        DateTimeOffset updatedAt, Guid? updatedBy)
    {
        if (siteId == Guid.Empty) throw new ArgumentException("A Site is required.", nameof(siteId));
        SiteId = siteId;
        Update(prefix, updatedAt, updatedBy);
    }

    public Guid SiteId { get; private set; }
    public string Prefix { get; private set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public void Update(string prefix, DateTimeOffset updatedAt, Guid? updatedBy)
    {
        Prefix = ReferenceCodePolicy.NormalizeCode(prefix, 2, 12);
        UpdatedAt = updatedAt;
        UpdatedBy = updatedBy;
    }
}

internal static class ReferenceCodePolicy
{
    internal static string NormalizeCode(string? value, int minimumLength, int maximumLength)
    {
        var normalized = (value ?? string.Empty).Trim().ToUpperInvariant();
        if (normalized.Length < minimumLength || normalized.Length > maximumLength ||
            normalized[0] is < 'A' or > 'Z' ||
            normalized.Any(character => character is not (>= 'A' and <= 'Z') and not (>= '0' and <= '9')))
            throw new ArgumentException($"Use {minimumLength}-{maximumLength} uppercase letters or digits, beginning with a letter.");
        return normalized;
    }

    internal static string DefaultSitePrefix(string name, Guid siteId)
    {
        var letters = new StringBuilder();
        foreach (var character in name.Normalize(NormalizationForm.FormD))
        {
            var upper = char.ToUpperInvariant(character);
            if (upper is >= 'A' and <= 'Z') letters.Append(upper);
            if (letters.Length == 4) break;
        }
        if (letters.Length < 2) letters.Append("SITE");
        return $"{letters.ToString()[..Math.Min(letters.Length, 4)]}{siteId:N}"[..8].ToUpperInvariant();
    }

    internal static string Format(string sitePrefix, long number, int minimumDigits) =>
        $"{sitePrefix}-{number.ToString($"D{minimumDigits}", System.Globalization.CultureInfo.InvariantCulture)}";
}
