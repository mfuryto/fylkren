namespace Fylkren.Api;

internal static class RequestQueryPolicy
{
    internal const int MaximumPage = 1_000_000;
    internal const int MaximumPageSize = 100;
    internal const int MaximumSearchLength = 200;

    internal static IResult? Validate(int? page, string? search, int? pageSize = null)
    {
        if (page is < 1 or > MaximumPage)
            return Validation("page", $"Sidenummer må være mellom 1 og {MaximumPage:N0}.");
        if (pageSize is < 1 or > MaximumPageSize)
            return Validation("pageSize", $"Sidestørrelse må være mellom 1 og {MaximumPageSize}.");
        if (search?.Trim().Length > MaximumSearchLength)
            return Validation("search", $"Søket kan ikke være lengre enn {MaximumSearchLength} tegn.");
        return null;
    }

    internal static string LikePattern(string value) =>
        $"%{value.Trim().Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal)}%";

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}
