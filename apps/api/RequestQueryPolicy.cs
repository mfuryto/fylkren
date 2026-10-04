namespace Fylkren.Api;

internal static class RequestQueryPolicy
{
    internal const int MaximumPage = 1_000_000;
    internal const int MaximumPageSize = 100;
    internal const int MaximumSearchLength = 200;

    internal static IResult? Validate(int? page, string? search, int? pageSize = null)
    {
        if (page is < 1 or > MaximumPage)
            return Validation("page", $"The page number must be between 1 and {MaximumPage:N0}.");
        if (pageSize is < 1 or > MaximumPageSize)
            return Validation("pageSize", $"The page size must be between 1 and {MaximumPageSize}.");
        if (search?.Trim().Length > MaximumSearchLength)
            return Validation("search", $"The search cannot exceed {MaximumSearchLength} characters.");
        return null;
    }

    internal static string LikePattern(string value) =>
        $"%{value.Trim().Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal)}%";

    internal static IResult? ValidateChoice(string field, string? value, params string[] allowed)
    {
        if (string.IsNullOrEmpty(value) || allowed.Contains(value, StringComparer.Ordinal)) return null;
        return Validation(field, $"The {field} value is not supported.");
    }

    internal static IResult? ValidateMaximumLength(string field, string? value, int maximum)
    {
        if (value is null || value.Trim().Length <= maximum) return null;
        return Validation(field, $"The {field} cannot exceed {maximum} characters.");
    }

    internal static IResult? ValidateLimit(int? limit, int maximum = MaximumPageSize)
    {
        if (limit is null || limit.Value >= 1 && limit.Value <= maximum) return null;
        return Validation("limit", $"The limit must be between 1 and {maximum}.");
    }

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}
