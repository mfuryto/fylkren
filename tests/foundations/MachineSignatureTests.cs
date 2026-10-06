using Fylkren.Api.Platform;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text;

internal static class MachineSignatureTests
{
    internal static void Run()
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        var generated = ApiMachineSignatures.Create();
        const string timestamp = "1791230400";
        const string nonce = "AQIDBAUGBwgJCgsMDQ4PEA";
        var bodyHash = ApiMachineSignatures.BodyHash("{\"name\":\"synthetic\"}"u8);
        var canonical = ApiMachineSignatures.Canonical("post", "/api/v1/administration/sites?mode=test",
            timestamp, nonce, bodyHash);
        var signature = ApiMachineSignatures.Sign(generated.PrivateKeyPem, canonical);
        Require(generated.Algorithm == ApiMachineSignatures.Algorithm && signature.Length == 86,
            "New machine signing material did not use the bound v2 algorithm.");
        Require(ApiMachineSignatures.Verify(generated.PublicKey, canonical, signature),
            "A valid machine request signature was rejected.");
        foreach (var changed in new[]
        {
            canonical.Replace("POST", "PUT", StringComparison.Ordinal),
            canonical.Replace("mode=test", "mode=other", StringComparison.Ordinal),
            canonical.Replace(timestamp, "1791230401", StringComparison.Ordinal),
            canonical.Replace(nonce, nonce + "A", StringComparison.Ordinal),
            canonical.Replace(bodyHash, new string('0', 64), StringComparison.Ordinal),
        })
            Require(!ApiMachineSignatures.Verify(generated.PublicKey, changed, signature),
                "A signature remained valid after a canonical request component changed.");
        Require(!ApiMachineSignatures.Verify(generated.PublicKey, canonical, "not-a-signature"),
            "Malformed signature material was accepted.");
        var identity = new ApiMachineIdentity(Guid.NewGuid(), "Signed", generated.KeyId, generated.PublicKey,
            generated.Algorithm, "sites:read", DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow);
        Require(identity.AuthenticationMode == ApiMachineIdentity.SignedV2 && identity.PublicKey is not null &&
            identity.SecretHash.Length == 0, "Signed identity retained a reusable bearer credential.");
        Console.WriteLine("Machine-signature tests passed: P-256 issuance, bound method/target/time/nonce/body, tamper rejection and no reusable bearer secret.");
    }

    internal static async Task RunDatabase(FylkrenDbContext db)
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        var migrator = db.GetService<IMigrator>();
        var migrations = db.GetService<IMigrationsAssembly>().Migrations.Keys.ToArray();
        var signedMigration = migrations.Single(value => value.EndsWith("_AddSignedMachineAuthentication"));
        var previous = migrations.TakeWhile(value => value != signedMigration).Last();
        await migrator.MigrateAsync(previous);
        var legacyId = Guid.NewGuid();
        var salt = new byte[16];
        var hash = new byte[32];
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO api_machine_identities(id,name,key_id,salt,secret_hash,secret_algorithm,secret_hash_version,secret_iterations,scopes,expires_at,created_at,is_active) VALUES({legacyId},'Legacy overlap','overlap000000001',{salt},{hash},'pbkdf2-sha512',2,220000,'sites:read',{DateTimeOffset.UtcNow.AddDays(1)},{DateTimeOffset.UtcNow},true)");
        await migrator.MigrateAsync(signedMigration);
        db.ChangeTracker.Clear();
        var legacy = await db.ApiMachineIdentities.SingleAsync(value => value.Id == legacyId);
        Require(legacy.AuthenticationMode == ApiMachineIdentity.BearerV1 && legacy.PublicKey is null,
            "Migration did not preserve and label the existing bearer client.");
        Require(legacy.LegacyBearerAcceptedUntil == legacy.ExpiresAt,
            "Migration did not bind legacy Bearer acceptance to the earlier existing expiry.");
        var generated = ApiMachineSignatures.Create();
        var signed = new ApiMachineIdentity(Guid.NewGuid(), "Signed database", generated.KeyId, generated.PublicKey,
            generated.Algorithm, "sites:read", DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow);
        db.ApiMachineIdentities.Add(signed);
        var nonce = new ApiMachineRequestNonce(signed.Id, "AQIDBAUGBwgJCgsMDQ4PEA", DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow.AddMinutes(5));
        db.ApiMachineRequestNonces.Add(nonce);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        Require(await db.ApiMachineRequestNonces.CountAsync(value => value.MachineIdentityId == signed.Id) == 1,
            "Replay nonce was not persisted with the signed identity.");
        db.ApiMachineRequestNonces.Add(new ApiMachineRequestNonce(signed.Id, nonce.Nonce,
            DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddMinutes(5)));
        try
        {
            await db.SaveChangesAsync();
            throw new Exception("A replayed machine nonce passed the database uniqueness boundary.");
        }
        catch (DbUpdateException) { db.ChangeTracker.Clear(); }

        var accepted = 0;
        var middleware = new ApiMachineAuthenticationMiddleware(context =>
        {
            context.Response.StatusCode = context.User.Identity?.IsAuthenticated == true ? 204 : 401;
            if (context.Response.StatusCode == 204) accepted++;
            return Task.CompletedTask;
        });
        using var limiter = new ApiMachineAuthenticationLimiter(false);
        async Task<HttpContext> SignedRequest(string requestNonce, long time, string requestBody = "",
            ApiMachineIdentity? target = null, string? privateKey = null)
        {
            target ??= signed;
            privateKey ??= generated.PrivateKeyPem;
            var context = new DefaultHttpContext();
            context.Request.Method = "POST";
            context.Request.Path = "/api/v1/administration/sites";
            context.Request.QueryString = new QueryString("?source=foundation");
            context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(requestBody));
            var bodyHash = ApiMachineSignatures.BodyHash(Encoding.UTF8.GetBytes(requestBody));
            var timestamp = time.ToString(System.Globalization.CultureInfo.InvariantCulture);
            var canonical = ApiMachineSignatures.Canonical(context.Request.Method,
                $"{context.Request.Path}{context.Request.QueryString}", timestamp, requestNonce, bodyHash);
            context.Request.Headers.Authorization = $"{ApiMachineSignatures.Scheme} {target.KeyId}";
            context.Request.Headers["X-Fylkren-Timestamp"] = timestamp;
            context.Request.Headers["X-Fylkren-Nonce"] = requestNonce;
            context.Request.Headers["X-Fylkren-Content-SHA256"] = bodyHash;
            context.Request.Headers["X-Fylkren-Signature"] = ApiMachineSignatures.Sign(privateKey, canonical);
            await middleware.InvokeAsync(context, db, limiter, NullLogger<ApiMachineAuthenticationMiddleware>.Instance);
            return context;
        }
        var currentTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        db.ChangeTracker.Clear();
        var valid = await SignedRequest("ERITFBUWFxgZGhscHR4fIA", currentTime, "{\"value\":1}");
        Require(valid.Response.StatusCode == 204 && accepted == 1 &&
            valid.User.HasClaim("scope", "sites:read") && !valid.User.HasClaim("scope", "sites:write"),
            "Valid signed middleware request did not retain its least-privilege scope.");
        var acceptedNonce = await db.ApiMachineRequestNonces.AsNoTracking().SingleAsync(value =>
            value.MachineIdentityId == signed.Id && value.Nonce == "ERITFBUWFxgZGhscHR4fIA");
        Require(acceptedNonce.ExpiresAt == DateTimeOffset.FromUnixTimeSeconds(currentTime).Add(ApiMachineSignatures.AllowedClockSkew),
            "Replay state did not cover the complete accepted timestamp window.");
        db.ChangeTracker.Clear();
        var replay = await SignedRequest("ERITFBUWFxgZGhscHR4fIA", currentTime, "{\"value\":1}");
        Require(replay.Response.StatusCode == 401 && accepted == 1, "Replayed signed request was accepted.");
        db.ChangeTracker.Clear();
        var stale = await SignedRequest("ISIjJCUmJygpKissLS4vMA", currentTime - 301);
        Require(stale.Response.StatusCode == 401 && accepted == 1, "Expired signed request was accepted.");
        var expiredKey = ApiMachineSignatures.Create();
        var expiredIdentity = new ApiMachineIdentity(Guid.NewGuid(), "Expired signed", expiredKey.KeyId,
            expiredKey.PublicKey, expiredKey.Algorithm, "sites:read", DateTimeOffset.UtcNow.AddSeconds(-1), DateTimeOffset.UtcNow.AddDays(-1));
        db.ApiMachineIdentities.Add(expiredIdentity);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var expiredClient = await SignedRequest("QUJDREVGR0hJSktMTU5PUA", currentTime, "", expiredIdentity, expiredKey.PrivateKeyPem);
        Require(expiredClient.Response.StatusCode == 401 && accepted == 1, "Expired signed client was accepted.");
        db.ChangeTracker.Clear();
        signed = await db.ApiMachineIdentities.SingleAsync(value => value.Id == signed.Id);
        signed.Deactivate();
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var disabled = await SignedRequest("MTIzNDU2Nzg5Ojs8PT4_QA", currentTime);
        Require(disabled.Response.StatusCode == 401 && accepted == 1, "Deactivated signed client was accepted.");
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM api_machine_identities WHERE id={signed.Id}");
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM api_machine_identities WHERE id={expiredIdentity.Id}");
        await migrator.MigrateAsync(previous);
        await migrator.MigrateAsync(signedMigration);
        Console.WriteLine("Machine-signature database tests passed: populated v1 overlap, v2 persistence, request authentication, expiry, revocation, replay rejection and reversible schema migration.");
    }
}
