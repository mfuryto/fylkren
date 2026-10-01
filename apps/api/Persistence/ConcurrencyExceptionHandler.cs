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
        if (exception is not DbUpdateConcurrencyException) return false;

        httpContext.Response.StatusCode = StatusCodes.Status409Conflict;
        await Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "The data was changed by another operation.",
            detail: "Load the updated data and try the action again.",
            extensions: new Dictionary<string, object?> { ["code"] = "concurrency_conflict" })
            .ExecuteAsync(httpContext);
        return true;
    }
}
