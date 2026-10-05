using Fylkren.Api.Networking;
using System.Globalization;
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
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption.ConfigurationModel;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Sustainsys.Saml2;
using Sustainsys.Saml2.AspNetCore2;
using Sustainsys.Saml2.Configuration;
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
        var outbound = new OutboundHttpPolicy(fylkrenOptions.Outbound.PrivateOrigins, fylkrenOptions.Outbound.AdditionalIdentityOrigins);
        builder.Services.AddSingleton(outbound);
        builder.Services.AddSingleton<ServiceDestinationPolicy>();
        builder.Services.AddSingleton<SamlMetadataCache>();
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

        builder.Services.AddExceptionHandler<ExternalAuthenticationExceptionHandler>();
        builder.Services.AddExceptionHandler<WebAuthnVerificationExceptionHandler>();
        builder.Services.AddExceptionHandler<ConcurrencyExceptionHandler>();
        builder.Services.AddProblemDetails();
        builder.WebHost.ConfigureKestrel(options =>
        {
            // The supported edge and gateway chain uses HTTP/1.x. Keeping the
            // unpublished API on the same parser contract avoids an untested
            // clear-text HTTP/2 message boundary behind the gateway.
            options.ConfigureEndpointDefaults(endpoint => endpoint.Protocols = HttpProtocols.Http1);
            options.Limits.MaxRequestBodySize = 3 * 1024 * 1024;
        });
        builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 3 * 1024 * 1024);
        builder.Services.AddHealthChecks();
        if (requireHttps)
            builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(
                builder.Configuration["Fylkren:DataProtection:KeyPath"] ?? "/var/lib/fylkren/keys"))
            .SetApplicationName("Fylkren")
            .UseCryptographicAlgorithms(new AuthenticatedEncryptorConfiguration
            {
                EncryptionAlgorithm = EncryptionAlgorithm.AES_256_CBC,
                ValidationAlgorithm = ValidationAlgorithm.HMACSHA256
            });
        var authentication = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
            {
                options.Cookie.Name = requireHttps ? "__Host-Fylkren" : "Fylkren.Session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(1);
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
        authentication.AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
            {
                var oidc = fylkrenOptions.Authentication.Oidc;
                options.Authority = oidc.Enabled ? oidc.Authority : "https://disabled.invalid";
                options.ClientId = oidc.Enabled ? oidc.ClientId : "disabled";
                options.ClientSecret = oidc.Enabled ? oidc.ClientSecret : "disabled";
                options.CallbackPath = fylkrenOptions.Authentication.Oidc.CallbackPath;
                options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.ResponseType = "code";
                options.MapInboundClaims = false;
                options.SaveTokens = false;
                // Every new Fylkren session requires a fresh provider authentication. The local
                // cookie then governs the bounded application session independently.
                options.MaxAge = TimeSpan.FromMinutes(5);
                if (requireHttps)
                {
                    options.CorrelationCookie.Name = "__Host-Fylkren.Oidc.Correlation.";
                    options.CorrelationCookie.Path = "/";
                    options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;
                    options.CorrelationCookie.HttpOnly = true;
                    options.NonceCookie.Name = "__Host-Fylkren.Oidc.Nonce.";
                    options.NonceCookie.Path = "/";
                    options.NonceCookie.SecurePolicy = CookieSecurePolicy.Always;
                    options.NonceCookie.HttpOnly = true;
                }
                options.GetClaimsFromUserInfoEndpoint = true;
                options.Scope.Clear(); options.Scope.Add("openid"); options.Scope.Add("profile"); options.Scope.Add("email");
                options.TokenValidationParameters.NameClaimType = "name";
                options.TokenValidationParameters.ValidAlgorithms = [SecurityAlgorithms.RsaSha256];
                options.TokenValidationParameters.ValidTypes = ["JWT"];
                options.Events.OnRedirectToIdentityProvider = context =>
                {
                    context.ProtocolMessage.Prompt = "login";
                    return Task.CompletedTask;
                };
                options.Events.OnRemoteFailure = async context =>
                {
                    var logger = context.HttpContext.RequestServices
                        .GetRequiredService<ILoggerFactory>()
                        .CreateLogger("Fylkren.Security.Authentication");
                    logger.LogWarning(
                        new EventId(4101, "ExternalAuthenticationRejected"),
                        "Security event {SecurityEvent}; authenticationScheme={AuthenticationScheme}; traceId={TraceId}",
                        "external-authentication-rejected",
                        OpenIdConnectDefaults.AuthenticationScheme,
                        context.HttpContext.TraceIdentifier);
                    context.HandleResponse();
                    // A provider can fail after parts of the remote flow have completed. Never let
                    // a rejected callback retain or create a local application session.
                    await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    context.Response.ContentType = "application/problem+json";
                    context.Response.Headers.CacheControl = "no-store";
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "external_authentication_failed"
                    });
                };
                options.Events.OnTokenValidated = async context =>
                {
                    if (!context.SecurityToken.Payload.TryGetValue("auth_time", out var authenticationTimeValue) ||
                        !long.TryParse(
                            Convert.ToString(authenticationTimeValue, CultureInfo.InvariantCulture),
                            NumberStyles.Integer,
                            CultureInfo.InvariantCulture,
                            out var authenticationTimeSeconds))
                    {
                        context.Fail("OIDC authentication time is missing or invalid.");
                        return;
                    }

                    DateTimeOffset authenticationTime;
                    try
                    {
                        authenticationTime = DateTimeOffset.FromUnixTimeSeconds(authenticationTimeSeconds);
                    }
                    catch (ArgumentOutOfRangeException)
                    {
                        context.Fail("OIDC authentication time is invalid.");
                        return;
                    }

                    var now = DateTimeOffset.UtcNow;
                    var allowedClockSkew = TimeSpan.FromMinutes(1);
                    if (authenticationTime > now.Add(allowedClockSkew) ||
                        now - authenticationTime > options.MaxAge!.Value.Add(allowedClockSkew))
                    {
                        context.Fail("OIDC authentication is too old.");
                        return;
                    }

                    var subject = context.Principal?.FindFirst("sub")?.Value;
                    if (string.IsNullOrWhiteSpace(subject)) { context.Fail("OIDC subject is missing."); return; }
                    var providerInstanceId = fylkrenOptions.Authentication.Oidc.Authority?.TrimEnd('/');
                    if (string.IsNullOrWhiteSpace(providerInstanceId)) { context.Fail("OIDC provider identity is missing."); return; }
                    await using var scope = context.HttpContext.RequestServices.CreateAsyncScope();
                    var database = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                    var link = await database.ExternalIdentityLinks.AsNoTracking().SingleOrDefaultAsync(value =>
                        value.Provider == "oidc" && value.ProviderInstanceId == providerInstanceId &&
                        value.SubjectId == subject && value.IsActive);
                    if (link is null) { context.Fail("OIDC identity is not linked to a Fylkren person."); return; }
                    var identity = await database.LoginIdentities.Include(value => value.Person).SingleOrDefaultAsync(value => value.PersonId == link.PersonId && value.IsActive && value.Person.IsActive);
                    if (identity is null || !identity.IsPlatformManager &&
                        !await IdentityEndpoints.HasActiveAccess(identity.PersonId, database, context.HttpContext.RequestAborted))
                    { context.Fail("Linked Fylkren identity is inactive or has no active access."); return; }
                    identity.RecordSignIn(DateTimeOffset.UtcNow);
                    var browserSession = IdentityEndpoints.StartBrowserSession(
                        identity, database, context.HttpContext, "oidc");
                    await database.SaveChangesAsync();
                    context.Principal = IdentityEndpoints.CreatePrincipal(identity, browserSession.Id);
                };
            });
        authentication.AddSaml2(Saml2Defaults.Scheme, options =>
            {
                var saml = fylkrenOptions.Authentication.Saml;
                options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                if (requireHttps) options.CookieManager = new HostPrefixCookieManager("__Host-Fylkren.Saml2.");
                options.SPOptions.EntityId = new EntityId(saml.Enabled ? saml.EntityId! : "https://disabled.invalid/fylkren");
                options.SPOptions.ModulePath = saml.ModulePath;
                options.SPOptions.NameIdPolicy = new Saml2NameIdPolicy(null, NameIdFormat.Persistent);
                options.SPOptions.MinIncomingSigningAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
                options.Notifications.AuthenticationRequestCreated = (request, _, _) =>
                    request.ForceAuthentication = true;
                // Fylkren does not currently provision a private SP signing certificate. Explicitly
                // send unsigned AuthnRequests while continuing to require the IdP metadata-backed
                // signature validation performed by Sustainsys for SAML responses and assertions.
                options.SPOptions.AuthenticateRequestSigningBehavior = SigningBehavior.Never;
                var identityProvider = new IdentityProvider(new EntityId(saml.Enabled ? saml.IdentityProviderEntityId! : "https://disabled.invalid/idp"), options.SPOptions);
                if (saml.Enabled)
                {
                    // Metadata is prepared asynchronously before the SAML handler is initialized.
                    // Library WebClient downloads/redirects and artifact fetches are not enabled.
                    // The injected options configurator below supplies prepared metadata.
                }
                else
                {
                    identityProvider.SingleSignOnServiceUrl = new Uri("https://disabled.invalid/sso");
                }
                options.IdentityProviders.Add(identityProvider);
            });
        builder.Services.AddOptions<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme)
            .Configure<IHttpClientFactory>((options, clients) => options.Backchannel = clients.CreateClient("identity-provider-runtime"));
        builder.Services.AddOptions<Saml2Options>(Saml2Defaults.Scheme).Configure<SamlMetadataCache>((options, metadata) =>
        {
            var saml = fylkrenOptions.Authentication.Saml;
            if (!saml.Enabled) return;
            var provider = options.IdentityProviders[new EntityId(saml.IdentityProviderEntityId!)];
            provider.ReadMetadata(metadata.Prepared(saml));
            provider.ArtifactResolutionServiceUrls.Clear();
        });
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddSingleton<IAuthenticationSchemeProvider, SamlRequestSchemeProvider>();
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
        builder.Services.AddSingleton<DirectoryLifecycleSynchronizer>();
        builder.Services.AddSingleton<IdentityProviderConfigurationService>();
        builder.Services.AddSingleton<HostStatusReader>();
        builder.Services.AddFido2(options =>
        {
            options.ServerDomain = fylkrenOptions.Authentication.WebAuthn.RpId;
            options.ServerName = fylkrenOptions.Authentication.WebAuthn.DisplayName;
            options.Origins = fylkrenOptions.Authentication.WebAuthn.Origins;
        });
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = (context, _) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
                    context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(
                        System.Globalization.CultureInfo.InvariantCulture);
                }
                return ValueTask.CompletedTask;
            };
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                if (context.Request.Path.StartsWithSegments("/health"))
                    return RateLimitPartition.GetNoLimiter("health");
                var write = context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE";
                return RateLimitPartition.GetFixedWindowLimiter(
                    $"global:{(write ? "write" : "read")}:{InteractiveRatePartition(context, trustForwardedHeaders)}",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = write ? 120 : 600,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });
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
            options.AddPolicy("costly-operation", context => RateLimitPartition.GetFixedWindowLimiter(
                $"costly:{InteractiveRatePartition(context, trustForwardedHeaders)}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 6, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
            options.AddPolicy("bounded-upload", context => RateLimitPartition.GetFixedWindowLimiter(
                $"bounded-upload:{InteractiveRatePartition(context, trustForwardedHeaders)}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
            options.AddPolicy("integration-test", context => RateLimitPartition.GetFixedWindowLimiter(
                $"integration-test:{InteractiveRatePartition(context, trustForwardedHeaders)}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });
        builder.Services.AddDbContext<FylkrenDbContext>(options =>
            options.UseNpgsql(
                builder.Configuration.GetConnectionString("Fylkren"),
                postgres => postgres.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
        builder.Services.AddHostedService<NotificationDeliveryWorker>();
        builder.Services.AddHttpClient("webhooks", client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new BoundedResponseHandler(outbound.CreateTransport(), null));
        builder.Services.AddHttpClient("federation-probe", client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new BoundedResponseHandler(outbound.CreateTransport(), 1_000_000));
        builder.Services.AddHttpClient("identity-provider-runtime", client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new BoundedResponseHandler(outbound.CreateTransport(), 2_000_000,
                uri => outbound.ValidateIdentityDestination(uri, fylkrenOptions.Authentication.Oidc.Authority), rejectRedirects: true));
        builder.Services.AddHttpClient("identity-provider-test", client => client.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => new BoundedResponseHandler(outbound.CreateTransport(), 2_000_000, rejectRedirects: true));
        builder.Services.AddHostedService<FederationKeyRotationWorker>();
        builder.Services.AddHostedService<FederationOutboundDeliveryWorker>();
        builder.Services.AddHostedService<WebhookDeliveryWorker>();
        builder.Services.AddHostedService<ApiMaintenanceWorker>();
        builder.Services.AddHostedService<Fylkren.Api.InformationLifecycle.WorkLifecycleWorker>();
        builder.Services.AddHostedService<DirectoryLifecycleWorker>();
        return new FylkrenStartupSettings(fylkrenOptions, trustForwardedHeaders, requireHttps);
    }

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
            var hasAccess = sessionIdentity is not null &&
                securityVersionMatches &&
                browserSession is not null && browserSession.IsActive(now, securityVersion) &&
                (sessionIdentity.IsPlatformManager ||
                 await IdentityEndpoints.HasActiveAccess(sessionIdentity.PersonId, sessionDatabase, context.HttpContext.RequestAborted));
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
                sessionIdentity, browserSession.Id, sessionStartedAt, directoryManaged, mfaSatisfied));
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
        var runtimeOptions = context.HttpContext.RequestServices.GetRequiredService<FylkrenOptions>();
        var providerInstanceId = runtimeOptions.Authentication.Saml.IdentityProviderEntityId?.Trim();
        if (string.IsNullOrWhiteSpace(providerInstanceId))
        {
            context.RejectPrincipal();
            return;
        }
        var link = await database.ExternalIdentityLinks.AsNoTracking()
            .SingleOrDefaultAsync(value => value.Provider == "saml" && value.ProviderInstanceId == providerInstanceId &&
                value.SubjectId == subject && value.IsActive);
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
        var externalSessionStartedAt = context.Properties.IssuedUtc ?? DateTimeOffset.UtcNow;
        if (DateTimeOffset.UtcNow - externalSessionStartedAt >= TimeSpan.FromHours(12))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        var samlBrowserSession = IdentityEndpoints.StartBrowserSession(
            identity, database, context.HttpContext, "saml", externalSessionStartedAt);
        await database.SaveChangesAsync();
        context.ReplacePrincipal(IdentityEndpoints.CreatePrincipal(identity, samlBrowserSession.Id, externalSessionStartedAt));
        context.ShouldRenew = true;
    }
}
