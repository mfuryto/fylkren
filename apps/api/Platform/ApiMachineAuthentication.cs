using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class ApiMachineSecrets
{
    public const string LegacyAlgorithm = "pbkdf2-sha256";
    public const int LegacyVersion = 1;
    public const int LegacyIterations = 210_000;
    public const string CurrentAlgorithm = "pbkdf2-sha512";
    public const int CurrentVersion = 2;
    public const int CurrentIterations = 220_000;

    public static GeneratedMachineSecret Create()
    {
        var keyId = Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var salt = RandomNumberGenerator.GetBytes(16);
        return new($"api_{keyId}.{secret}", keyId, salt,
            Hash(secret, salt, CurrentAlgorithm, CurrentIterations), CurrentAlgorithm, CurrentVersion, CurrentIterations);
    }

    public static bool Verify(string secret, ApiMachineIdentity identity)
    {
        if (!Supported(identity.SecretAlgorithm, identity.SecretHashVersion, identity.SecretIterations)) return false;
        var candidate = Hash(secret, identity.Salt, identity.SecretAlgorithm, identity.SecretIterations);
        return candidate.Length == identity.SecretHash.Length &&
            CryptographicOperations.FixedTimeEquals(candidate, identity.SecretHash);
    }

    public static bool NeedsUpgrade(ApiMachineIdentity identity) =>
        identity.SecretAlgorithm != CurrentAlgorithm || identity.SecretHashVersion != CurrentVersion ||
        identity.SecretIterations != CurrentIterations;

    public static void Upgrade(string secret, ApiMachineIdentity identity)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        identity.UpgradeSecret(salt, Hash(secret, salt, CurrentAlgorithm, CurrentIterations),
            CurrentAlgorithm, CurrentVersion, CurrentIterations);
    }

    internal static byte[] Hash(string secret, byte[] salt, string algorithm, int iterations) =>
        Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(secret), salt, iterations,
            algorithm == CurrentAlgorithm ? HashAlgorithmName.SHA512 : HashAlgorithmName.SHA256, 32);

    private static bool Supported(string algorithm, int version, int iterations) =>
        (algorithm, version, iterations) is (LegacyAlgorithm, LegacyVersion, >= 100_000 and <= 1_000_000) or
            (CurrentAlgorithm, CurrentVersion, >= 100_000 and <= 1_000_000);
}

public sealed record GeneratedMachineSecret(string Token, string KeyId, byte[] Salt, byte[] Hash,
    string Algorithm, int Version, int Iterations);

public static class ApiMachineSignatures
{
    public const string Algorithm = "ecdsa-p256-sha256-p1363";
    public const string Scheme = "Fylkren-Signature";
    public static readonly TimeSpan AllowedClockSkew = TimeSpan.FromMinutes(5);

    public static GeneratedMachineSigningKey Create()
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var keyId = Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
        return new(keyId, key.ExportSubjectPublicKeyInfo(), key.ExportPkcs8PrivateKeyPem(), Algorithm);
    }

    public static string Canonical(string method, string target, string timestamp, string nonce, string bodyHash) =>
        $"FYLKREN-MACHINE-V2\n{method.ToUpperInvariant()}\n{target}\n{timestamp}\n{nonce}\n{bodyHash}";

    public static string Sign(string privateKeyPem, string canonical)
    {
        using var key = ECDsa.Create();
        key.ImportFromPem(privateKeyPem);
        return Base64Url(key.SignData(Encoding.UTF8.GetBytes(canonical), HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
    }

    public static bool Verify(byte[] publicKey, string canonical, string signature)
    {
        if (!TryBase64Url(signature, out var bytes) || bytes.Length != 64) return false;
        try
        {
            using var key = ECDsa.Create();
            key.ImportSubjectPublicKeyInfo(publicKey, out var read);
            return read == publicKey.Length && key.VerifyData(Encoding.UTF8.GetBytes(canonical), bytes,
                HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        }
        catch (CryptographicException) { return false; }
    }

    public static string BodyHash(ReadOnlySpan<byte> body) => Convert.ToHexString(SHA256.HashData(body)).ToLowerInvariant();
    public static string Base64Url(ReadOnlySpan<byte> value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static bool TryBase64Url(string value, out byte[] bytes)
    {
        bytes = [];
        if (value.Length == 0 || value.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '-' or '_'))) return false;
        try
        {
            var padded = value.Replace('-', '+').Replace('_', '/');
            padded += new string('=', (4 - padded.Length % 4) % 4);
            bytes = Convert.FromBase64String(padded);
            return true;
        }
        catch (FormatException) { return false; }
    }
}

public sealed record GeneratedMachineSigningKey(string KeyId, byte[] PublicKey, string PrivateKeyPem, string Algorithm);

public sealed class ApiMachineAuthenticationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext context,
        FylkrenDbContext database,
        ApiMachineAuthenticationLimiter limiter,
        ILogger<ApiMachineAuthenticationMiddleware> logger)
    {
        if (!context.Request.Path.StartsWithSegments("/api/v1/administration") &&
            !context.Request.Path.StartsWithSegments("/api/v1/reports") &&
            !context.Request.Path.StartsWithSegments("/api/v1/work") &&
            !context.Request.Path.StartsWithSegments("/api/v1/openapi.json"))
        { await next(context); return; }
        var authorization = context.Request.Headers.Authorization.ToString();
        if (authorization.StartsWith($"{ApiMachineSignatures.Scheme} ", StringComparison.Ordinal))
        {
            if (await AuthenticateSignedAsync(context, database, limiter, logger, authorization[(ApiMachineSignatures.Scheme.Length + 1)..].Trim()))
                await next(context);
            else if (!context.Response.HasStarted && context.Response.StatusCode == StatusCodes.Status200OK)
                await next(context);
            return;
        }
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) { await next(context); return; }
        var token = authorization[7..].Trim(); var separator = token.IndexOf('.'); if (token.Length != 64 || !token.StartsWith("api_", StringComparison.Ordinal) || separator != 20) { await next(context); return; }
        var keyId = token[4..separator]; var secret = token[(separator + 1)..];
        var authenticationLease = await limiter.AcquireAsync(context, keyId, context.RequestAborted);
        if (authenticationLease is null)
        {
            logger.LogWarning(
                new EventId(4201, "MachineAuthenticationRateLimited"),
                "Security event {SecurityEvent}; traceId={TraceId}",
                "machine-authentication-rate-limited",
                context.TraceIdentifier);
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers.RetryAfter = "60";
            return;
        }
        ApiMachineIdentity? identity;
        var secretMatches = false;
        using (authenticationLease)
        {
            identity = await database.ApiMachineIdentities.SingleOrDefaultAsync(x => x.KeyId == keyId && x.IsActive && x.AuthenticationMode == ApiMachineIdentity.BearerV1);
            if (identity is not null && (identity.ExpiresAt is null || identity.ExpiresAt > DateTimeOffset.UtcNow) &&
                identity.LegacyBearerAcceptedUntil > DateTimeOffset.UtcNow)
                secretMatches = ApiMachineSecrets.Verify(secret, identity);
        }
        if (!secretMatches || identity is null) { await next(context); return; }
        SetPrincipal(context, identity);
        var now = DateTimeOffset.UtcNow;
        var mustSave = false;
        if (ApiMachineSecrets.NeedsUpgrade(identity)) { ApiMachineSecrets.Upgrade(secret, identity); mustSave = true; }
        if (identity.LastUsedAt is null || identity.LastUsedAt < now.AddMinutes(-5)) { identity.MarkUsed(now); mustSave = true; }
        if (mustSave) await database.SaveChangesAsync();
        await next(context);
    }

    private static async Task<bool> AuthenticateSignedAsync(HttpContext context, FylkrenDbContext database,
        ApiMachineAuthenticationLimiter limiter, ILogger logger, string keyId)
    {
        if (keyId.Length != 16 || keyId.Any(character => !char.IsAsciiHexDigit(character))) return false;
        var timestamp = SingleHeader(context, "X-Fylkren-Timestamp", 20);
        var nonce = SingleHeader(context, "X-Fylkren-Nonce", 96);
        var bodyHash = SingleHeader(context, "X-Fylkren-Content-SHA256", 64);
        var signature = SingleHeader(context, "X-Fylkren-Signature", 96);
        if (timestamp is null || nonce is null || bodyHash is null || signature is null ||
            nonce.Length is < 22 or > 96 || nonce.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '-' or '_')) ||
            bodyHash.Length != 64 || bodyHash.Any(character => !(character is >= '0' and <= '9' or >= 'a' and <= 'f')) ||
            !long.TryParse(timestamp, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var unixSeconds)) return false;
        DateTimeOffset signedAt;
        try { signedAt = DateTimeOffset.FromUnixTimeSeconds(unixSeconds); }
        catch (ArgumentOutOfRangeException) { return false; }
        var now = DateTimeOffset.UtcNow;
        if ((now - signedAt).Duration() > ApiMachineSignatures.AllowedClockSkew) return false;
        using var authenticationLease = await limiter.AcquireAsync(context, keyId, context.RequestAborted);
        if (authenticationLease is null)
        {
            logger.LogWarning(new EventId(4201, "MachineAuthenticationRateLimited"),
                "Security event {SecurityEvent}; traceId={TraceId}", "machine-authentication-rate-limited", context.TraceIdentifier);
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers.RetryAfter = "60";
            return false;
        }
        var identity = await database.ApiMachineIdentities.SingleOrDefaultAsync(value => value.KeyId == keyId &&
            value.IsActive && value.AuthenticationMode == ApiMachineIdentity.SignedV2, context.RequestAborted);
        if (identity?.PublicKey is null || identity.SignatureAlgorithm != ApiMachineSignatures.Algorithm ||
            identity.ExpiresAt is null || identity.ExpiresAt <= now) return false;
        context.Request.EnableBuffering();
        using var hash = SHA256.Create();
        var actualHash = Convert.ToHexString(await hash.ComputeHashAsync(context.Request.Body, context.RequestAborted)).ToLowerInvariant();
        context.Request.Body.Position = 0;
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(actualHash), Encoding.ASCII.GetBytes(bodyHash))) return false;
        var rawTarget = context.Features.Get<IHttpRequestFeature>()?.RawTarget;
        var target = string.IsNullOrEmpty(rawTarget)
            ? $"{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}"
            : rawTarget;
        var canonical = ApiMachineSignatures.Canonical(context.Request.Method, target, timestamp, nonce, bodyHash);
        if (!ApiMachineSignatures.Verify(identity.PublicKey, canonical, signature)) return false;
        database.ApiMachineRequestNonces.Add(new ApiMachineRequestNonce(identity.Id, nonce, now,
            signedAt.Add(ApiMachineSignatures.AllowedClockSkew)));
        identity.MarkUsed(now);
        try { await database.SaveChangesAsync(context.RequestAborted); }
        catch (DbUpdateException exception) when (exception.InnerException is Npgsql.PostgresException
            { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
        {
            logger.LogWarning(new EventId(4202, "MachineAuthenticationReplayRejected"),
                "Security event {SecurityEvent}; machineId={MachineId}; traceId={TraceId}",
                "machine-authentication-replay-rejected", identity.Id, context.TraceIdentifier);
            return false;
        }
        SetPrincipal(context, identity);
        return true;
    }

    private static string? SingleHeader(HttpContext context, string name, int maximumLength)
    {
        if (!context.Request.Headers.TryGetValue(name, out var values) || values.Count != 1) return null;
        var value = values[0];
        return value is not null && value.Length <= maximumLength ? value : null;
    }

    private static void SetPrincipal(HttpContext context, ApiMachineIdentity identity)
    {
        var claims = new List<Claim> { new("fylkren:machine_id", identity.Id.ToString()), new(ClaimTypes.Name, identity.Name) };
        claims.AddRange(identity.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(scope => new Claim("scope", scope)));
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "FylkrenMachine"));
    }
}

public sealed class ApiMachineAuthenticationLimiter : IDisposable
{
    private readonly bool _trustForwardedHeaders;
    private readonly PartitionedRateLimiter<string> _clientAttempts =
        PartitionedRateLimiter.Create<string, string>(partition =>
            RateLimitPartition.GetFixedWindowLimiter(partition, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 240,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
    private readonly PartitionedRateLimiter<string> _attempts =
        PartitionedRateLimiter.Create<string, string>(partition =>
            RateLimitPartition.GetFixedWindowLimiter(partition, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
    private readonly PartitionedRateLimiter<string> _concurrency =
        PartitionedRateLimiter.Create<string, string>(partition =>
            RateLimitPartition.GetConcurrencyLimiter(partition, _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = 2,
                QueueLimit = 0,
            }));
    private readonly SemaphoreSlim _globalHashSlots = new(16, 16);

    public ApiMachineAuthenticationLimiter(bool trustForwardedHeaders) =>
        _trustForwardedHeaders = trustForwardedHeaders;

    public async ValueTask<IDisposable?> AcquireAsync(
        HttpContext context,
        string keyId,
        CancellationToken cancellationToken)
    {
        var clientAddress = ClientAddress(context);
        using var clientAttempt = await _clientAttempts.AcquireAsync(clientAddress, 1, cancellationToken);
        if (!clientAttempt.IsAcquired) return null;
        var partition = $"{keyId}:{clientAddress}";
        using var attempt = await _attempts.AcquireAsync(partition, 1, cancellationToken);
        if (!attempt.IsAcquired) return null;
        var partitionLease = await _concurrency.AcquireAsync(partition, 1, cancellationToken);
        if (!partitionLease.IsAcquired)
        {
            partitionLease.Dispose();
            return null;
        }
        if (!await _globalHashSlots.WaitAsync(0, cancellationToken))
        {
            partitionLease.Dispose();
            return null;
        }
        return new AuthenticationLease(partitionLease, _globalHashSlots);
    }

    private string ClientAddress(HttpContext context)
    {
        if (!_trustForwardedHeaders &&
            context.Request.Headers.TryGetValue("X-Fylkren-Gateway-Client-IP", out var gatewayAddress) &&
            gatewayAddress.Count == 1 &&
            System.Net.IPAddress.TryParse(gatewayAddress[0], out var parsedAddress))
            return parsedAddress.ToString();
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    public void Dispose()
    {
        _clientAttempts.Dispose();
        _attempts.Dispose();
        _concurrency.Dispose();
        _globalHashSlots.Dispose();
    }

    private sealed class AuthenticationLease(
        RateLimitLease partitionLease,
        SemaphoreSlim globalHashSlots) : IDisposable
    {
        private int _disposed;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
            partitionLease.Dispose();
            globalHashSlots.Release();
        }
    }
}
