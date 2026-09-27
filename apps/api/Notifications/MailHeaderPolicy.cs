using System.Text;

namespace Fylkren.Api.Notifications;

internal static class MailHeaderPolicy
{
    internal static bool IsValidConfigurationValue(string value, int maximumLength) =>
        value.Length <= maximumLength && value.All(character => !char.IsControl(character));

    internal static string Normalize(string? value, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var result = new StringBuilder(Math.Min(value.Length, maximumLength));
        var pendingSpace = false;
        foreach (var character in value)
        {
            if (char.IsControl(character) || char.IsWhiteSpace(character))
            {
                pendingSpace = result.Length > 0;
                continue;
            }
            if (pendingSpace && result.Length + 1 < maximumLength) result.Append(' ');
            pendingSpace = false;
            if (result.Length >= maximumLength) break;
            result.Append(character);
        }
        return result.ToString().TrimEnd();
    }
}
