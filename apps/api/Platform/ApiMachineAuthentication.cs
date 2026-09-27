using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class ApiMachineSecrets
{
    public const int Iterations = 210_000;
    public static (string Token, string KeyId, byte[] Salt, byte[] Hash) Create() { var keyId = Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant(); var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_'); var salt = RandomNumberGenerator.GetBytes(16); return ($"api_{keyId}.{secret}", keyId, salt, Hash(secret, salt)); }
    public static byte[] Hash(string secret, byte[] salt) => Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(secret), salt, Iterations, HashAlgorithmName.SHA256, 32);
}

public sealed class ApiMachineAuthenticationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext context,
        FylkrenDbContext database,
        ApiMachineAuthenticationLimiter limiter,
        ILogger<ApiMachineAuthenticationMiddleware> logger)
    {
        if (!context.Request.Path.StartsWithSegments("/api/v1/administration") && !context.Request.Path.StartsWithSegments("/api/v1/reports")) { await next(context); return; }
        var authorization = context.Request.Headers.Authorization.ToString(); if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) { await next(context); return; }
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
            identity = await database.ApiMachineIdentities.SingleOrDefaultAsync(x => x.KeyId == keyId && x.IsActive);
            if (identity is not null && (identity.ExpiresAt is null || identity.ExpiresAt > DateTimeOffset.UtcNow))
                secretMatches = CryptographicOperations.FixedTimeEquals(
                    ApiMachineSecrets.Hash(secret, identity.Salt), identity.SecretHash);
        }
        if (!secretMatches || identity is null) { await next(context); return; }
        var claims = new List<Claim> { new("fylkren:machine_id", identity.Id.ToString()), new(ClaimTypes.Name, identity.Name) }; claims.AddRange(identity.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(scope => new Claim("scope", scope))); context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "FylkrenMachine"));
        var now = DateTimeOffset.UtcNow; if (identity.LastUsedAt is null || identity.LastUsedAt < now.AddMinutes(-5)) { identity.MarkUsed(now); await database.SaveChangesAsync(); }
        await next(context);
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
