using Fylkren.Api;
using Fylkren.Api.Organization;
using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Fylkren.Api.Platform;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Notifications;
using Fylkren.Api.Decisions;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Risks;
using Fylkren.Api.Portability;
using Fylkren.Api.Approvals;
using Fylkren.Api.Licensing;
using Fylkren.Api.Federation;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpContextAccessor();
var startupSettings = builder.AddFylkrenServices();
var fylkrenOptions = startupSettings.Options;
var trustForwardedHeaders = startupSettings.TrustForwardedHeaders;
var requireHttps = startupSettings.RequireHttps;

var app = builder.Build();

if (trustForwardedHeaders)
{
    app.UseForwardedHeaders();
}

app.UseMiddleware<CanonicalHostMiddleware>();

if (requireHttps)
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.Pragma = "no-cache";
        }
        context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
        context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
        context.Response.Headers.TryAdd("Referrer-Policy", "no-referrer");
        context.Response.Headers.TryAdd("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        context.Response.Headers.TryAdd("Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        return Task.CompletedTask;
    });
    await next();
});

app.UseExceptionHandler();
app.UseMiddleware<ExternalAuthenticationFailureCookieMiddleware>();
app.UseAuthentication();
app.UseMiddleware<ApiMachineAuthenticationMiddleware>();
app.UseMiddleware<SecurityEventMiddleware>();
app.UseMiddleware<BrowserAntiforgeryMiddleware>();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    var mustChangePassword = context.User.FindFirst("fylkren:must_change_password")?.Value == "true";
    var allowedWhileChanging = context.Request.Path.StartsWithSegments("/api/session") ||
        context.Request.Path.StartsWithSegments("/api/security/antiforgery") ||
        context.Request.Path.StartsWithSegments("/api/profile");
    if (mustChangePassword && context.Request.Path.StartsWithSegments("/api") && !allowedWhileChanging)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = "password_change_required" });
        return;
    }
    await next();
});
app.UseAuthorization();
app.UseAntiforgery();

await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
    await database.Database.MigrateAsync();
    await DatabaseDefaults.EnsureCreatedAsync(database, fylkrenOptions);
    await scope.ServiceProvider.GetRequiredService<IdentityProviderConfigurationService>()
        .InitializeAsync(database);
}

PublicConfigurationEndpoints.Map(app);

app.Use(async (context, next) =>
{
    if (!fylkrenOptions.Authentication.MfaEnabled && context.Request.Path.StartsWithSegments("/api/webauthn"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next(context);
});

app.MapHealthChecks("/health").AllowAnonymous();
app.MapOrganizationEndpoints();
app.MapAccessEndpoints();
app.MapIdentityEndpoints();
app.MapWorkItemEndpoints();
app.MapReferenceSettingsEndpoints();
app.MapDecisionEndpoints();
app.MapWorkflowEndpoints();
app.MapExecutionEndpoints();
app.MapBrandingEndpoints();
app.MapRegionalSettingsEndpoints();
app.MapClassificationEndpoints();
app.MapIdentityProviderEndpoints();
app.MapWebAuthnEndpoints();
app.MapTemplateEndpoints();
app.MapOidcEndpoints();
app.MapSamlEndpoints();
app.MapDirectoryEndpoints();
app.MapPlatformOperationsEndpoints();
app.MapSmtpEndpoints();
app.MapSiteAuditEndpoints();
app.MapPlatformAuditEndpoints();
app.MapSiteNotificationEndpoints();
app.MapAdministrationApiEndpoints();
app.MapReportApiEndpoints();
app.MapWebhookManagementEndpoints();
app.MapActivityQueryEndpoints();
Fylkren.Api.InformationLifecycle.WorkLifecycleEndpoints.MapWorkLifecycleEndpoints(app);
Fylkren.Api.InformationLifecycle.GovernanceLifecycleEndpoints.MapGovernanceLifecycleEndpoints(app);
Fylkren.Api.InformationLifecycle.PreservationEndpoints.MapPreservationEndpoints(app);
Fylkren.Api.InformationLifecycle.ArchiveReaderEndpoints.MapArchiveReaderEndpoints(app);
app.MapRiskEndpoints();
app.MapPortabilityEndpoints();
app.MapFormalApprovalEndpoints();
app.MapLicenseEndpoints();
app.MapFederationPeerEndpoints();
app.MapFederationIdentityEndpoints();
app.MapFederationProbeEndpoints();
app.MapFederationIdentityDiscoveryEndpoints();
app.MapFederationCapabilityEndpoints();
app.MapFederationKeyRotationEndpoints();
app.MapFederationCatalogEndpoints();
app.MapFederationDeliveryEndpoints();
app.MapFederationRoutingEndpoints();
app.MapFederationWorkReceiveEndpoints();
app.MapFederationOfficialAnswerReceiveEndpoints();
app.MapFederationProgressReceiveEndpoints();
app.MapFederationCancellationReceiveEndpoints();
if (app.Environment.IsEnvironment("FederationTest"))
{
    app.MapFederationAnswerAcceptanceTestEndpoints();
    app.MapFederationOutboundTestEndpoints();
}

app.Run();


public partial class Program;
