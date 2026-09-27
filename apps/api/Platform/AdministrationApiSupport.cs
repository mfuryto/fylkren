using System.Security.Claims;

namespace Fylkren.Api.Platform;

internal static class AdministrationApiSupport
{
    internal static bool MachineId(ClaimsPrincipal user, out Guid id) =>
        Guid.TryParse(user.FindFirstValue("fylkren:machine_id"), out id);

    internal static IResult Validation(string field, string message) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]> { { field, [message] } });

    internal static IResult Problem(
        HttpContext context,
        int status,
        string code,
        string title) =>
        Results.Problem(
            statusCode: status,
            title: title,
            extensions: new Dictionary<string, object?>
            {
                { "code", code },
                { "correlationId", context.TraceIdentifier },
            });
}
