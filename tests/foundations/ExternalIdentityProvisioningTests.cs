using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

internal static class ExternalIdentityProvisioningTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        await VerifyPendingAuthorization();
        await db.Database.MigrateAsync();
        var service = new ExternalIdentityProvisioningService();
        var stamp = Guid.NewGuid().ToString("N");
        var issuer = $"https://identity.example.invalid/{stamp}";

        var disabled = await service.ResolveAsync(db, "oidc", issuer, $"disabled-{stamp}",
            $"disabled-{stamp}", "Disabled user", $"disabled-{stamp}@example.invalid", false, default);
        Require(disabled is null && !await db.People.AnyAsync(value => value.DisplayName == "Disabled user"),
            "Disabled automatic provisioning created a person.");
        Require(await service.ResolveAsync(db, "saml", issuer, $"saml-disabled-{stamp}",
            $"saml-disabled-{stamp}", "Disabled SAML user", null, false, default) is null,
            "Disabled automatic SAML provisioning created a person.");

        var created = await service.ResolveAsync(db, "oidc", issuer, $"created-{stamp}",
            $"created-{stamp}", "Provisioned user", $"created-{stamp}@example.invalid", true, default);
        Require(created is { ProviderManaged: true } && created.Identity.Person.DisplayName == "Provisioned user",
            "Enabled automatic provisioning did not create a provider-managed person.");
        var personId = created!.Identity.PersonId;
        Require(await db.ExternalIdentityLinks.CountAsync(value => value.PersonId == personId && value.ProvisionedAt != null) == 1 &&
            await db.AuditEvents.AnyAsync(value => value.EntityId == personId && value.EventType == "identity.oidc.person-provisioned"),
            "Provisioning origin or system audit evidence was lost.");
        var samlCreated = await service.ResolveAsync(db, "saml", issuer, $"saml-created-{stamp}",
            $"saml-created-{stamp}", "Provisioned SAML user", $"saml-created-{stamp}@example.invalid", true, default);
        Require(samlCreated is { ProviderManaged: true } &&
            await db.ExternalIdentityLinks.AnyAsync(value => value.PersonId == samlCreated!.Identity.PersonId &&
                value.Provider == "saml" && value.ProvisionedAt != null),
            "Enabled automatic SAML provisioning did not create a provider-managed identity.");

        db.ChangeTracker.Clear();
        var repeated = await service.ResolveAsync(db, "oidc", issuer, $"created-{stamp}",
            $"created-{stamp}", "Updated provider name", $"created-{stamp}@example.invalid", true, default);
        Require(repeated?.Identity.PersonId == personId && repeated.Identity.Person.DisplayName == "Updated provider name" &&
            await db.ExternalIdentityLinks.CountAsync(value => value.ProviderInstanceId == issuer && value.SubjectId == $"created-{stamp}") == 1,
            "Repeated sign-in duplicated the person or failed to update provider-owned fields.");

        var explicitPerson = new Person(Guid.NewGuid(), "Explicit local person", DateTimeOffset.UtcNow,
            $"explicit-{stamp}@example.invalid");
        var explicitLogin = new LoginIdentity(Guid.NewGuid(), explicitPerson.Id, $"explicit-{stamp}", false, DateTimeOffset.UtcNow);
        var directoryLink = new ExternalIdentityLink(Guid.NewGuid(), explicitPerson.Id, "ldap", "directory.example.invalid",
            $"directory-subject-{stamp}", explicitLogin.Username, DateTimeOffset.UtcNow);
        var explicitLink = new ExternalIdentityLink(Guid.NewGuid(), explicitPerson.Id, "saml", issuer,
            $"explicit-subject-{stamp}", explicitLogin.Username, DateTimeOffset.UtcNow);
        explicitPerson.LoginIdentities.Add(explicitLogin);
        explicitPerson.ExternalIdentityLinks.Add(directoryLink);
        explicitPerson.ExternalIdentityLinks.Add(explicitLink);
        db.People.Add(explicitPerson);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var explicitResolution = await service.ResolveAsync(db, "saml", issuer, $"explicit-subject-{stamp}",
            "changed-provider-claim", "Provider display name", null, false, default);
        Require(explicitResolution is { ProviderManaged: false } && explicitResolution.Identity.PersonId == explicitPerson.Id &&
            explicitResolution.Identity.Person.DisplayName == "Explicit local person",
            "An explicit existing link stopped working or provider claims overwrote a locally managed person.");

        explicitLink = await db.ExternalIdentityLinks.SingleAsync(value => value.Id == explicitLink.Id);
        explicitLink.Deactivate();
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        Require(await service.ResolveAsync(db, "saml", issuer, $"explicit-subject-{stamp}",
            explicitLogin.Username, "Explicit local person", null, true, default) is null &&
            await db.ExternalIdentityProvisioningIssues.AnyAsync(value => value.Provider == "saml" &&
                value.SubjectId == $"explicit-subject-{stamp}" && value.Reason == "inactive-link"),
            "An unlinked SSO identity remained usable or was not exposed for review.");

        var collisionPerson = new Person(Guid.NewGuid(), "Existing collision", DateTimeOffset.UtcNow,
            $"collision-{stamp}@example.invalid");
        var collisionLogin = new LoginIdentity(Guid.NewGuid(), collisionPerson.Id, $"collision-{stamp}", false, DateTimeOffset.UtcNow);
        collisionPerson.LoginIdentities.Add(collisionLogin);
        db.People.Add(collisionPerson);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var collision = await service.ResolveAsync(db, "oidc", issuer, $"collision-subject-{stamp}",
            collisionLogin.Username, "Ambiguous person", collisionPerson.Email, true, default);
        var issue = await db.ExternalIdentityProvisioningIssues.SingleAsync(value =>
            value.ProviderInstanceId == issuer && value.SubjectId == $"collision-subject-{stamp}");
        Require(collision is null && issue.Reason == "claim-collision" && issue.ResolvedAt is null &&
            !await db.People.AnyAsync(value => value.DisplayName == "Ambiguous person"),
            "Ambiguous claims were merged automatically or were not exposed for administrative review.");
        issue.Resolve(DateTimeOffset.UtcNow);
        await db.SaveChangesAsync();
        Require(await db.ExternalIdentityProvisioningIssues.AnyAsync(value => value.Id == issue.Id && value.ResolvedAt != null),
            "Administrative resolution did not close the provisioning issue.");

        var concurrentSubject = $"concurrent-{stamp}";
        var options = new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(db.Database.GetConnectionString()).Options;
        await using var first = new FylkrenDbContext(options);
        await using var second = new FylkrenDbContext(options);
        var outcomes = await Task.WhenAll(
            service.ResolveAsync(first, "oidc", issuer, concurrentSubject, concurrentSubject,
                "Concurrent person", $"concurrent-{stamp}@example.invalid", true, default),
            service.ResolveAsync(second, "oidc", issuer, concurrentSubject, concurrentSubject,
                "Concurrent person", $"concurrent-{stamp}@example.invalid", true, default));
        db.ChangeTracker.Clear();
        Require(outcomes.All(value => value is { ProviderManaged: true }) &&
            outcomes.Select(value => value!.Identity.PersonId).Distinct().Count() == 1 &&
            await db.ExternalIdentityLinks.CountAsync(value => value.ProviderInstanceId == issuer && value.SubjectId == concurrentSubject) == 1,
            "Concurrent first sign-ins created duplicate people or links.");

        var namespaced = await service.ResolveAsync(db, "oidc", $"{issuer}/second", concurrentSubject,
            $"second-{stamp}", "Second issuer person", $"second-{stamp}@example.invalid", true, default);
        Require(namespaced is { ProviderManaged: true } && namespaced.Identity.PersonId != outcomes[0]!.Identity.PersonId,
            "The same subject text from a different issuer was merged across provider namespaces.");

        Console.WriteLine("External identity provisioning tests passed: disabled/enabled, provider ownership, explicit links, collisions, review and concurrent first sign-in.");
    }

    private static async Task VerifyPendingAuthorization()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization(IdentityAuthorization.Configure);
        await using var provider = services.BuildServiceProvider();
        var policies = provider.GetRequiredService<IAuthorizationPolicyProvider>();
        var authorization = provider.GetRequiredService<IAuthorizationService>();
        var pending = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("fylkren:access_granted", "false")], "test"));
        var granted = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("fylkren:access_granted", "true")], "test"));
        var defaultPolicy = await policies.GetDefaultPolicyAsync();
        var pendingPolicy = await policies.GetPolicyAsync(IdentityAuthorization.AuthenticatedIncludingPending)
            ?? throw new Exception("Pending-access policy is missing.");
        Require(!(await authorization.AuthorizeAsync(pending, null, defaultPolicy)).Succeeded &&
            (await authorization.AuthorizeAsync(pending, null, pendingPolicy)).Succeeded &&
            (await authorization.AuthorizeAsync(granted, null, defaultPolicy)).Succeeded,
            "Pending identity was not isolated from the default operational API policy.");
    }

    private static void Require(bool value, string message)
    {
        if (!value) throw new Exception(message);
    }
}
