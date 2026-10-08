namespace Fylkren.Api.Platform;

public sealed class RegionalSettings
{
    private static readonly Dictionary<string, string> SupportedLanguages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["en"] = "en-US", ["en-US"] = "en-US", ["en-GB"] = "en-GB",
        ["nb"] = "nb-NO", ["nb-NO"] = "nb-NO", ["no"] = "nb-NO", ["no-NO"] = "nb-NO",
        ["sv"] = "sv-SE", ["sv-SE"] = "sv-SE",
        ["da"] = "da-DK", ["da-DK"] = "da-DK",
        ["fi"] = "fi-FI", ["fi-FI"] = "fi-FI",
        ["de"] = "de-DE", ["de-DE"] = "de-DE",
        ["fr"] = "fr-FR", ["fr-FR"] = "fr-FR",
        ["pl"] = "pl-PL", ["pl-PL"] = "pl-PL",
        ["es"] = "es-ES", ["es-ES"] = "es-ES",
        ["it"] = "it-IT", ["it-IT"] = "it-IT",
        ["uk"] = "uk-UA", ["uk-UA"] = "uk-UA",
        ["nl"] = "nl-NL", ["nl-NL"] = "nl-NL",
        ["pt"] = "pt-PT", ["pt-PT"] = "pt-PT",
        ["cs"] = "cs-CZ", ["cs-CZ"] = "cs-CZ",
        ["ro"] = "ro-RO", ["ro-RO"] = "ro-RO",
        ["et"] = "et-EE", ["et-EE"] = "et-EE",
        ["lv"] = "lv-LV", ["lv-LV"] = "lv-LV",
        ["lt"] = "lt-LT", ["lt-LT"] = "lt-LT"
    };

    private RegionalSettings() { }

    public RegionalSettings(Guid id, string defaultLanguage, string timeZone)
    {
        Id = id;
        DefaultLanguage = NormalizeLanguage(defaultLanguage);
        TimeZone = NormalizeTimeZone(timeZone);
        ClockFormat = "24-hour";
        MeasurementSystem = "metric";
    }

    public Guid Id { get; private set; }
    public string DefaultLanguage { get; private set; } = "en-US";
    public string TimeZone { get; private set; } = "UTC";
    public string ClockFormat { get; private set; } = "24-hour";
    public string MeasurementSystem { get; private set; } = "metric";

    public void Update(string defaultLanguage, string timeZone, string clockFormat, string measurementSystem)
    {
        DefaultLanguage = NormalizeLanguage(defaultLanguage);
        TimeZone = timeZone.Trim();
        ClockFormat = clockFormat;
        MeasurementSystem = measurementSystem;
    }

    public static string NormalizeLanguage(string? value)
    {
        var language = BaseLanguage(value);
        return SupportedLanguages.GetValueOrDefault(language, "en-US");
    }

    public static bool IsSupportedLanguage(string? value) =>
        SupportedLanguages.ContainsKey(BaseLanguage(value));

    private static string BaseLanguage(string? value)
    {
        var language = (value ?? "").Trim();
        var unicodeExtension = language.IndexOf("-u-", StringComparison.OrdinalIgnoreCase);
        var privateUseExtension = language.IndexOf("-x-", StringComparison.OrdinalIgnoreCase);
        var boundary = new[] { unicodeExtension, privateUseExtension }.Where(index => index >= 0).DefaultIfEmpty(language.Length).Min();
        return language[..boundary];
    }

    private static string NormalizeTimeZone(string? value)
    {
        var timeZone = (value ?? "").Trim();
        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(timeZone);
            return timeZone;
        }
        catch (TimeZoneNotFoundException) { return "UTC"; }
        catch (InvalidTimeZoneException) { return "UTC"; }
    }
}
