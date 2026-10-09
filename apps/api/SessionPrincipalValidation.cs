using System.Security.Claims;
using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api;

internal static partial class ServiceRegistration
{
    static string ApiRatePartition(HttpContext context) => context.User.FindFirst("fylkren:machine_id")?.Value ?? $"unauthenticated:{context.Connection.RemoteIpAddress}";

    static string InteractiveRatePartition(HttpContext context, bool trustForwardedHeaders) =>
        context.User.FindFirst("fylkren:person_id")?.Value is { Length: > 0 } personId ? $"person:{personId}" :
        context.User.FindFirst("fylkren:machine_id")?.Value is { Length: > 0 } machineId ? $"machine:{machineId}" :
        AuthenticationRatePartition(context, trustForwardedHeaders);

    static string AuthenticationRatePartition(HttpContext context, bool trustForwardedHeaders)
    {
        var clientAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (!trustForwardedHeaders && context.Request.Headers.TryGetValue("X-Fylkren-Gateway-Client-IP", out var gatewayAddress) &&
            gatewayAddress.Count == 1 && System.Net.IPAddress.TryParse(gatewayAddress[0], out var parsedAddress))
            clientAddress = parsedAddress.ToString();
        return $"authentication:{clientAddress}";
    }

    static async Task ValidateSessionPrincipal(CookieValidatePrincipalContext context)
    {
        if (context.Principal?.FindFirst("fylkren:person_id") is not null)
        {
            var now = DateTimeOffset.UtcNow;
            var sessionStartedValue = context.Principal.FindFirst("fylkren:session_started_at")?.Value;
            var sessionStartedAt = long.TryParse(sessionStartedValue, out var sessionStarted)
                ? DateTimeOffset.FromUnixTimeSeconds(sessionStarted)
                : context.Properties.IssuedUtc ?? now;
            if (now - sessionStartedAt >= TimeSpan.FromHours(12))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            var directoryManaged = context.Principal.FindFirst("fylkren:directory_managed")?.Value == "true";
            var mfaSatisfied = context.Principal.FindFirst("fylkren:mfa_satisfied")?.Value == "true";
            if (!Guid.TryParse(context.Principal.FindFirstValue(ClaimTypes.NameIdentifier), out var identityId))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            var sessionDatabase = context.HttpContext.RequestServices.GetRequiredService<FylkrenDbContext>();
            if (!Guid.TryParse(context.Principal.FindFirst("fylkren:session_id")?.Value, out var sessionId))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }
            var sessionIdentity = await sessionDatabase.LoginIdentities.Include(value => value.Person)
                .SingleOrDefaultAsync(value => value.Id == identityId && value.IsActive && value.Person.IsActive);
            var browserSession = await sessionDatabase.BrowserSessions
                .SingleOrDefaultAsync(value => value.Id == sessionId && value.LoginIdentityId == identityId);
            var securityVersionValue = context.Principal.FindFirst("fylkren:security_version")?.Value;
            var securityVersionMatches = long.TryParse(securityVersionValue, out var securityVersion) &&
                sessionIdentity?.SecurityVersion == securityVersion;
            var sessionHasOperationalAccess = sessionIdentity is not null &&
                (sessionIdentity.IsPlatformManager ||
                 await IdentityEndpoints.HasActiveAccess(sessionIdentity.PersonId, sessionDatabase, context.HttpContext.RequestAborted));
            var pendingProvisionedAccess = sessionIdentity is not null && browserSession is not null &&
                browserSession.AuthenticationMethod is "oidc" or "saml" &&
                await sessionDatabase.ExternalIdentityLinks.AsNoTracking().AnyAsync(value =>
                    value.PersonId == sessionIdentity.PersonId && value.Provider == browserSession.AuthenticationMethod &&
                    value.IsActive && value.ProvisionedAt != null, context.HttpContext.RequestAborted);
            var hasAccess = sessionIdentity is not null && securityVersionMatches && browserSession is not null &&
                browserSession.IsActive(now, securityVersion) && (sessionHasOperationalAccess || pendingProvisionedAccess);
            if (!hasAccess || sessionIdentity is null || browserSession is null)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            if (now - browserSession.LastSeenAt >= TimeSpan.FromMinutes(2))
            {
                browserSession.Seen(now);
                await sessionDatabase.SaveChangesAsync(context.HttpContext.RequestAborted);
            }
            context.ReplacePrincipal(IdentityEndpoints.CreatePrincipal(
                sessionIdentity, browserSession.Id, sessionStartedAt, directoryManaged, mfaSatisfied, sessionHasOperationalAccess));
            context.ShouldRenew = true;
            return;
        }

        var subject = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrWhiteSpace(subject)) { context.RejectPrincipal(); return; }
        var database = context.HttpContext.RequestServices.GetRequiredService<FylkrenDbContext>();
        var runtimeOptions = context.HttpContext.RequestServices.GetRequiredService<FylkrenOptions>();
        var providerInstanceId = runtimeOptions.Authentication.Saml.IdentityProviderEntityId?.Trim();
        if (string.IsNullOrWhiteSpace(providerInstanceId)) { context.RejectPrincipal(); return; }
        var provisioning = context.HttpContext.RequestServices.GetRequiredService<ExternalIdentityProvisioningService>();
        var resolution = await provisioning.ResolveAsync(database, "saml", providerInstanceId, subject,
            context.Principal?.FindFirst(ClaimTypes.Upn)?.Value ?? context.Principal?.FindFirst(ClaimTypes.Email)?.Value,
            context.Principal?.FindFirst(ClaimTypes.Name)?.Value ?? context.Principal?.Identity?.Name,
            context.Principal?.FindFirst(ClaimTypes.Email)?.Value ?? context.Principal?.FindFirst("email")?.Value,
            runtimeOptions.Authentication.Saml.AutomaticProvisioning, context.HttpContext.RequestAborted);
        if (resolution is null) { context.RejectPrincipal(); return; }
        var identity = resolution.Identity;
        var hasOperationalAccess = identity.IsPlatformManager ||
            await IdentityEndpoints.HasActiveAccess(identity.PersonId, database, context.HttpContext.RequestAborted);
        if (!hasOperationalAccess && !resolution.ProviderManaged) { context.RejectPrincipal(); return; }

        identity.RecordSignIn(DateTimeOffset.UtcNow);
        var externalSessionStartedAt = context.Properties.IssuedUtc ?? DateTimeOffset.UtcNow;
        if (DateTimeOffset.UtcNow - externalSessionStartedAt >= TimeSpan.FromHours(12))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        var samlBrowserSession = IdentityEndpoints.StartBrowserSession(identity, database, context.HttpContext, "saml", externalSessionStartedAt);
        await database.SaveChangesAsync();
        context.ReplacePrincipal(IdentityEndpoints.CreatePrincipal(identity, samlBrowserSession.Id,
            externalSessionStartedAt, accessGranted: hasOperationalAccess));
        context.ShouldRenew = true;
    }
}
