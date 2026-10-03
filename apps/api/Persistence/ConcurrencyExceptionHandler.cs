using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal sealed class ConcurrencyExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not DbUpdateConcurrencyException &&
            exception is not DbUpdateException { InnerException: Npgsql.PostgresException { ConstraintName: "work_lifecycle_guard" or "activity_writer_gate" or "domain_activity_immutable" or "activity_context_owner" } }) return false;

        var locked = exception is DbUpdateException { InnerException: Npgsql.PostgresException { ConstraintName: "work_lifecycle_guard" } };

        httpContext.Response.StatusCode = StatusCodes.Status409Conflict;
        await Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: locked ? "The content is locked or archived." : "The data was changed by another operation.",
            detail: locked ? "Reopen the content through Lock/Archive before editing. Archived content must first be restored to locked." : "Load the updated data and try the action again.",
            extensions: new Dictionary<string, object?> { ["code"] = locked ? "information_locked" : "concurrency_conflict" })
            .ExecuteAsync(httpContext);
        return true;
    }
}
