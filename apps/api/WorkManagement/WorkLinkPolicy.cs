namespace Fylkren.Api.WorkManagement;

internal static class WorkLinkPolicy
{
    internal static bool TryNormalize(string? value, out string? normalized)
    {
        normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (normalized is null) return true;
        if (normalized.Length > 2048 || normalized.Any(char.IsControl) ||
            !Uri.TryCreate(normalized, UriKind.Absolute, out var uri) ||
            !normalized.StartsWith(uri.Scheme + ":", StringComparison.OrdinalIgnoreCase) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            uri.Scheme is not ("https" or "http" or "file" or "smb") ||
            uri.Scheme is "https" or "http" or "smb" && string.IsNullOrWhiteSpace(uri.Host))
        {
            normalized = null;
            return false;
        }

        return true;
    }
}
