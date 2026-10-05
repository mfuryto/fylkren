using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;

namespace Fylkren.Api.Identity;

public static partial class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api");

        group.MapGet("/session", GetSession).AllowAnonymous();

        group.MapGet("/security/antiforgery", (IAntiforgery antiforgery, HttpContext context) =>
            Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken }))
            .RequireAuthorization();

        group.MapPost("/session", SignIn).AllowAnonymous().RequireRateLimiting("authentication");
        group.MapPost("/password-reset/complete", CompletePasswordReset).AllowAnonymous().RequireRateLimiting("authentication");
        group.MapPost("/session/2fa", CompleteTwoFactorSignIn).AllowAnonymous().RequireRateLimiting("authentication");
        group.MapDelete("/session", async (ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            FylkrenDbContext database, CancellationToken cancellationToken) =>
            {
                await antiforgery.ValidateRequestAsync(context);
                return await SignOut(user, context, database, cancellationToken);
            })
            .RequireAuthorization();
        group.MapGet("/profile", GetProfile).RequireAuthorization();
        group.MapGet("/profile/sessions", ListBrowserSessions).RequireAuthorization();
        group.MapDelete("/profile/sessions/{id:guid}", RevokeBrowserSession).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapDelete("/profile/sessions", RevokeAllBrowserSessions).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPost("/profile/2fa/setup", BeginTotpSetup).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPost("/profile/2fa/confirm", ConfirmTotpSetup).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPost("/profile/2fa/challenge", CompleteProfileMfaChallenge).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapDelete("/profile/2fa", DisableTotp).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPut("/profile", UpdateProfile).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPut("/profile/password", ChangePassword).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPut("/profile/image", UpdateProfileImage).RequireAuthorization();
        group.MapDelete("/profile/image", DeleteProfileImage).RequireAuthorization();
        group.MapGet("/profile/image", GetProfileImage).RequireAuthorization();
        group.MapPost("/bootstrap/platform-manager", BootstrapPlatformManager)
            .AllowAnonymous()
            .RequireRateLimiting("authentication");

        return endpoints;
    }
    private sealed record SignInRequest(string? Username, string? Password);
    private sealed record TwoFactorSignInRequest(string? ChallengeToken, string? Code);
    private sealed record TotpSetupRequest(string? SetupToken, string? Code);
    private sealed record TotpChallengeRequest(string? Code);
    private sealed record DisableTotpRequest(string? Password);
    private sealed record ReauthenticationRequest(string? CurrentPassword);
    private sealed record BootstrapRequest(string Username, string DisplayName, string Email, string Password);
    private sealed record CompletePasswordResetRequest(string? ResetCode, string? NewPassword);
}
