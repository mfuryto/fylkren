using Microsoft.AspNetCore.Authorization;

namespace Fylkren.Api.Identity;

public static class IdentityAuthorization
{
    public const string AuthenticatedIncludingPending = nameof(AuthenticatedIncludingPending);

    public static void Configure(AuthorizationOptions options)
    {
        options.DefaultPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireClaim("fylkren:access_granted", "true")
            .Build();
        options.FallbackPolicy = options.DefaultPolicy;
        options.AddPolicy(AuthenticatedIncludingPending, policy => policy.RequireAuthenticatedUser());
        options.AddPolicy("MachineApi", policy => policy.RequireAuthenticatedUser().RequireClaim("fylkren:machine_id"));
    }
}
