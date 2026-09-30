namespace Fylkren.Api.Platform;

public sealed class RegionalSettings
{
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
    public string DefaultLanguage { get; private set; } = "en";
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
        var language = (value ?? "").Trim();
        if (language.Equals("nb", StringComparison.OrdinalIgnoreCase) ||
            language.Equals("nb-NO", StringComparison.OrdinalIgnoreCase) ||
            language.Equals("no", StringComparison.OrdinalIgnoreCase) ||
            language.Equals("no-NO", StringComparison.OrdinalIgnoreCase))
            return "nb-NO";
        return "en";
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
