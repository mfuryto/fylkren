using System.Security.Claims;
using System.Threading.RateLimiting;
using Fido2NetLib;
using Fylkren.Api.Identity;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Notifications;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.Licensing;
using Fylkren.Api.Federation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Sustainsys.Saml2;
using Sustainsys.Saml2.AspNetCore2;
using Sustainsys.Saml2.Metadata;
using Sustainsys.Saml2.Saml2P;

namespace Fylkren.Api;

internal sealed record FylkrenStartupSettings(
    FylkrenOptions Options,
    bool TrustForwardedHeaders,
    bool RequireHttps);

internal static class ServiceRegistration
{
    internal static FylkrenStartupSettings AddFylkrenServices(
        this WebApplicationBuilder builder)
    {
        var fylkrenOptions = new FylkrenOptions();
        builder.Configuration.GetSection("Fylkren").Bind(fylkrenOptions);
        fylkrenOptions.Validate();
        builder.Services.AddSingleton(fylkrenOptions);
        builder.Services.AddSingleton(new LicenseService(builder.Configuration["Fylkren:License:PublicKeySpki"]));
        var technicalLogBuffer = new TechnicalLogBuffer(300);
        builder.Logging.AddProvider(technicalLogBuffer);
        builder.Services.AddSingleton(technicalLogBuffer);
        var trustForwardedHeaders = builder.Configuration.GetValue<bool>("Fylkren:Http:TrustForwardedHeaders");
        var requireHttps = builder.Configuration.GetValue<bool>("Fylkren:Http:RequireHttps");
        var forwardedHeaderLimit = builder.Configuration.GetValue<int?>("Fylkren:Http:ForwardedHeaderLimit") ?? 1;
        if (forwardedHeaderLimit is < 1 or > 2)
            throw new InvalidOperationException("Fylkren:Http:ForwardedHeaderLimit must be 1 or 2.");

        if (trustForwardedHeaders)
        {
            builder.Services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

                // The API has no published host port in the supported Compose topology. When this
                // setting is enabled, its only caller is the web gateway on the private Docker network.
                options.KnownIPNetworks.Clear();
                options.KnownProxies.Clear();
                options.ForwardLimit = forwardedHeaderLimit;
            });
        }

        builder.Services.AddSingleton(new ApiMachineAuthenticationLimiter(trustForwardedHeaders));

        builder.Services.AddExceptionHandler<ConcurrencyExceptionHandler>();
        builder.Services.AddProblemDetails();
        builder.WebHost.ConfigureKestrel(options =>
            options.Limits.MaxRequestBodySize = 3 * 1024 * 1024);
        builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 3 * 1024 * 1024);
        builder.Services.AddHealthChecks();
        if (requireHttps)
            builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(
                builder.Configuration["Fylkren:DataProtection:KeyPath"] ?? "/var/lib/fylkren/keys"))
            .SetApplicationName("Fylkren");
        var authentication = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
            {
                options.Cookie.Name = requireHttps ? "__Host-Fylkren" : "Fylkren.Session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
                options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
                options.Events.OnSignedIn = context =>
                {
                    var logger = context.HttpContext.RequestServices
                        .GetRequiredService<ILoggerFactory>()
                        .CreateLogger("Fylkren.Security.Authentication");
                    logger.LogInformation(
                        new EventId(4100, "AuthenticationSucceeded"),
                        "Security event {SecurityEvent}; authenticationScheme={AuthenticationScheme}; traceId={TraceId}",
                        "authentication-succeeded",
                        context.Scheme.Name,
                        context.HttpContext.TraceIdentifier);
                    return Task.CompletedTask;
                };
                options.Events.OnValidatePrincipal = ValidateSessionPrincipal;
            });
        if (fylkrenOptions.Authentication.Oidc.Enabled)
        {
            authentication.AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
            {
                options.Authority = fylkrenOptions.Authentication.Oidc.Authority;
                options.ClientId = fylkrenOptions.Authentication.Oidc.ClientId;
                options.ClientSecret = fylkrenOptions.Authentication.Oidc.ClientSecret;
                options.CallbackPath = fylkrenOptions.Authentication.Oidc.CallbackPath;
                options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.ResponseType = "code";
                options.MapInboundClaims = false;
                options.SaveTokens = false;
                options.GetClaimsFromUserInfoEndpoint = true;
                options.Scope.Clear(); options.Scope.Add("openid"); options.Scope.Add("profile"); options.Scope.Add("email");
                options.TokenValidationParameters.NameClaimType = "name";
                options.Events.OnTokenValidated = async context =>
                {
                    var subject = context.Principal?.FindFirst("sub")?.Value;
                    if (string.IsNullOrWhiteSpace(subject)) { context.Fail("OIDC subject is missing."); return; }
                    await using var scope = context.HttpContext.RequestServices.CreateAsyncScope();
                    var database = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                    var link = await database.ExternalIdentityLinks.AsNoTracking().SingleOrDefaultAsync(value => value.Provider == "oidc" && value.SubjectId == subject && value.IsActive);
                    if (link is null) { context.Fail("OIDC identity is not linked to a Fylkren person."); return; }
                    var identity = await database.LoginIdentities.Include(value => value.Person).SingleOrDefaultAsync(value => value.PersonId == link.PersonId && value.IsActive && value.Person.IsActive);
                    if (identity is null || !identity.IsPlatformManager &&
                        !await IdentityEndpoints.HasActiveAccess(identity.PersonId, database, context.HttpContext.RequestAborted))
                    { context.Fail("Linked Fylkren identity is inactive or has no active access."); return; }
                    identity.RecordSignIn(DateTimeOffset.UtcNow);
                    await database.SaveChangesAsync();
                    context.Principal = IdentityEndpoints.CreatePrincipal(identity);
                };
            });
        }
        if (fylkrenOptions.Authentication.Saml.Enabled)
        {
            authentication.AddSaml2(Saml2Defaults.Scheme, options =>
            {
                var saml = fylkrenOptions.Authentication.Saml;
                options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.SPOptions.EntityId = new EntityId(saml.EntityId!);
                options.SPOptions.ModulePath = saml.ModulePath;
                options.SPOptions.NameIdPolicy = new Saml2NameIdPolicy(null, NameIdFormat.Persistent);
                options.IdentityProviders.Add(new IdentityProvider(new EntityId(saml.IdentityProviderEntityId!), options.SPOptions)
                {
                    LoadMetadata = true,
                    MetadataLocation = saml.MetadataUrl
                });
            });
        }
        builder.Services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
            options.AddPolicy("MachineApi", policy => policy.RequireAuthenticatedUser().RequireClaim("fylkren:machine_id"));
        });
        builder.Services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-Fylkren-CSRF";
            options.Cookie.Name = requireHttps ? "__Host-Fylkren.Antiforgery" : "Fylkren.Antiforgery";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
            options.Cookie.SameSite = SameSiteMode.Strict;
        });
        builder.Services.Configure<Microsoft.AspNetCore.Identity.PasswordHasherOptions>(options =>
            options.IterationCount = 220_000);
        builder.Services.AddScoped<Microsoft.AspNetCore.Identity.IPasswordHasher<LoginIdentity>, Microsoft.AspNetCore.Identity.PasswordHasher<LoginIdentity>>();
        builder.Services.AddSingleton<PasswordSecurityPolicy>();
        builder.Services.AddSingleton<TotpService>();
        builder.Services.AddSingleton<WebAuthnFlowService>();
        builder.Services.AddSingleton<DirectoryAuthenticationService>();
        builder.Services.AddFido2(options =>
        {
            options.ServerDomain = fylkrenOptions.Authentication.WebAuthn.RpId;
            options.ServerName = fylkrenOptions.Authentication.WebAuthn.DisplayName;
            options.Origins = fylkrenOptions.Authentication.WebAuthn.Origins;
        });
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("authentication", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    AuthenticationRatePartition(context, trustForwardedHeaders),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 8,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    }));
            options.AddPolicy("administration-api", context => RateLimitPartition.GetFixedWindowLimiter(ApiRatePartition(context), _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
            options.AddPolicy("administration-api-write", context => RateLimitPartition.GetFixedWindowLimiter(ApiRatePartition(context), _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
            options.AddPolicy("federation-probe", context => RateLimitPartition.GetFixedWindowLimiter(
                $"federation-probe:{AuthenticationRatePartition(context, trustForwardedHeaders)}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
            options.AddPolicy("federation-capability", context => RateLimitPartition.GetFixedWindowLimiter(
                $"federation-capability:{AuthenticationRatePartition(context, trustForwardedHeaders)}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });
        builder.Services.AddDbContext<FylkrenDbContext>(options =>
            options.UseNpgsql(
                builder.Configuration.GetConnectionString("Fylkren"),
                postgres => postgres.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
        builder.Services.AddHostedService<NotificationDeliveryWorker>();
        builder.Services.AddHttpClient("webhooks", client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddHttpClient("federation-probe", client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddHostedService<FederationKeyRotationWorker>();
        builder.Services.AddHostedService<FederationOutboundDeliveryWorker>();
        builder.Services.AddHostedService<WebhookDeliveryWorker>();
        builder.Services.AddHostedService<ApiMaintenanceWorker>();
        return new FylkrenStartupSettings(fylkrenOptions, trustForwardedHeaders, requireHttps);
    }

    static string ApiRatePartition(HttpContext context) => context.User.FindFirst("fylkren:machine_id")?.Value ?? $"unauthenticated:{context.Connection.RemoteIpAddress}";

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

            var validatedAtValue = context.Principal.FindFirst("fylkren:validated_at")?.Value;
            if (long.TryParse(validatedAtValue, out var validatedAt) &&
                now - DateTimeOffset.FromUnixTimeSeconds(validatedAt) < TimeSpan.FromMinutes(2))
                return;

            if (!Guid.TryParse(context.Principal.FindFirstValue(ClaimTypes.NameIdentifier), out var identityId))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            var sessionDatabase = context.HttpContext.RequestServices.GetRequiredService<FylkrenDbContext>();
            var sessionIdentity = await sessionDatabase.LoginIdentities.Include(value => value.Person)
                .SingleOrDefaultAsync(value => value.Id == identityId && value.IsActive && value.Person.IsActive);
            var securityVersionValue = context.Principal.FindFirst("fylkren:security_version")?.Value;
            var securityVersionMatches = long.TryParse(securityVersionValue, out var securityVersion) &&
                sessionIdentity?.SecurityVersion == securityVersion;
            var hasAccess = sessionIdentity is not null &&
                securityVersionMatches &&
                (sessionIdentity.IsPlatformManager ||
                 await IdentityEndpoints.HasActiveAccess(sessionIdentity.PersonId, sessionDatabase, context.HttpContext.RequestAborted));
            if (!hasAccess || sessionIdentity is null)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            context.ReplacePrincipal(IdentityEndpoints.CreatePrincipal(sessionIdentity, sessionStartedAt));
            context.ShouldRenew = true;
            return;
        }

        var subject = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            context.RejectPrincipal();
            return;
        }

        var database = context.HttpContext.RequestServices.GetRequiredService<FylkrenDbContext>();
        var link = await database.ExternalIdentityLinks.AsNoTracking()
            .SingleOrDefaultAsync(value => value.Provider == "saml" && value.SubjectId == subject && value.IsActive);
        if (link is null)
        {
            context.RejectPrincipal();
            return;
        }

        var identity = await database.LoginIdentities.Include(value => value.Person)
            .SingleOrDefaultAsync(value => value.PersonId == link.PersonId && value.IsActive && value.Person.IsActive);
        if (identity is null || !identity.IsPlatformManager &&
            !await IdentityEndpoints.HasActiveAccess(identity.PersonId, database, context.HttpContext.RequestAborted))
        {
            context.RejectPrincipal();
            return;
        }

        identity.RecordSignIn(DateTimeOffset.UtcNow);
        await database.SaveChangesAsync();
        var externalSessionStartedAt = context.Properties.IssuedUtc ?? DateTimeOffset.UtcNow;
        if (DateTimeOffset.UtcNow - externalSessionStartedAt >= TimeSpan.FromHours(12))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        context.ReplacePrincipal(IdentityEndpoints.CreatePrincipal(identity, externalSessionStartedAt));
        context.ShouldRenew = true;
    }
}
