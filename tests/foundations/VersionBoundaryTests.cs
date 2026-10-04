using System.Text.Json;
using Fylkren.Api.Identity;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Organization;
using Fylkren.Api.Learning;
using Fylkren.Api.Portability;
using Fylkren.Api.Federation;
using Fylkren.Api;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Notifications;

internal static class VersionBoundaryTests
{
    internal static void Run()
    {
        var now = DateTimeOffset.UtcNow;
        var count = 0;
        void Boundary<T>(Func<T> create, string property, Action<T> mutate)
        {
            var getter = typeof(T).GetProperty(property)!;
            var maximum = getter.PropertyType == typeof(int) ? (object)int.MaxValue : long.MaxValue;
            var beforeLast = getter.PropertyType == typeof(int) ? (object)(int.MaxValue - 1) : long.MaxValue - 1;
            var last = create(); getter.SetValue(last, beforeLast); mutate(last);
            if (!Equals(getter.GetValue(last), maximum)) throw new Exception("Last representable version was not preserved.");
            var exhausted = create(); getter.SetValue(exhausted, maximum);
            var snapshot = JsonSerializer.Serialize(exhausted);
            try { mutate(exhausted); }
            catch (InvalidOperationException)
            {
                if (JsonSerializer.Serialize(exhausted) != snapshot) throw new Exception("Capacity rejection partially changed domain state.");
                count++;
                return;
            }
            Console.WriteLine($"Unprotected version boundary: {typeof(T).Name}.{property}, after={getter.GetValue(exhausted)}, stateChanged={JsonSerializer.Serialize(exhausted) != snapshot}");
            throw new Exception("Version capacity wrapped or mutated the resource instead of rejecting atomically.");
        }
        LoginIdentity Identity() => new(Guid.NewGuid(), Guid.NewGuid(), "synthetic-version", false, now);
        Boundary(Identity, "SecurityVersion", value => value.SetPasswordHash("Synthetic hash"));
        Boundary(Identity, "SecurityVersion", value => value.Update("synthetic-renamed", true));
        Boundary(Identity, "SecurityVersion", value => value.Update("synthetic-version", false));
        Boundary(Identity, "SecurityVersion", value => value.Delete());
        Boundary(Identity, "SecurityVersion", value => value.EnableTotp("Synthetic protected secret", ["Synthetic recovery hash"]));
        Boundary(Identity, "SecurityVersion", value => value.DisableTotp());
        Boundary(Identity, "SecurityVersion", value => value.AdvanceSecurityVersion());
        InformationLifecycleRecord Lifecycle() => new(Guid.NewGuid(), Guid.NewGuid(), "work_item", Guid.NewGuid(), null, now);
        Boundary(Lifecycle, "Version", value => value.Transition("closed", value.Version, "Synthetic closure", now));
        Boundary(Lifecycle, "Version", value => value.SetAutomationPaused(true));
        Boundary(Lifecycle, "Version", value => value.SetHold(true, value.Version, "Synthetic hold", now));
        Boundary(Lifecycle, "Version", value => value.BindPolicy(Guid.NewGuid(), 1, value.Version, "Synthetic binding", now));
        Site Site() => new(Guid.NewGuid(), "Synthetic version Site", now);
        Boundary(Site, "Version", value => value.Update("Synthetic renamed Site", null, false));
        Boundary(Site, "Version", value => value.UpdateOverviewDesign("classic"));
        Boundary(() => new LearningLesson(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1,
            "positive", "Synthetic", Guid.NewGuid(), "Synthetic author", now), "Version",
            value => value.Review("in_progress", "high", "Synthetic action", "Synthetic treatment", null, Guid.NewGuid(), "Synthetic reviewer", now));
        Boundary(() => new ArchiveGrant(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), true, now), "Version",
            value => value.Revoke(value.Version, now));
        Boundary(() => new ExportReceipt(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), now, "Synthetic snapshot", new string('a', 64), 1, 0), "Version",
            value => value.Acknowledge(value.Version, Guid.NewGuid(), value.PackageSha256, "Synthetic custody", now));
        FederationSitePublication Publication() => new(Guid.NewGuid(), Guid.NewGuid(), now);
        Boundary(Publication, "Revision", value => value.Refresh(now));
        Boundary(Publication, "Revision", value => value.SetActive(false, now));
        Boundary(() => new FederationSiteGrant(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "outbound", now),
            "Revision", value => value.SetActive(false, now));
        Boundary(() => new EventProjection("webhooks", Guid.NewGuid(), now), "AttemptCount",
            value => value.Claim(Guid.NewGuid(), now));
        Boundary(() => new WebhookDelivery(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), now), "AttemptCount",
            value => value.Start(now));
        foreach (Action action in new Action[] { () => NumericBounds.NextVersion(int.MaxValue), () => NumericBounds.NextVersion(-1),
            () => NumericBounds.NextVersion(long.MaxValue), () => NumericBounds.NextVersion(-1L) })
        {
            try { action(); throw new Exception("Invalid revision boundary passed."); }
            catch (NumericCapacityException) { }
        }
        if (NumericBounds.NextVersion(int.MaxValue - 1) != int.MaxValue || NumericBounds.NextVersion(0) != 1)
            throw new Exception("Integer revision limits changed.");
        var noOp = Lifecycle(); typeof(InformationLifecycleRecord).GetProperty("Version")!.SetValue(noOp, long.MaxValue);
        noOp.SetAutomationPaused(false);
        var publicationNoOp = Publication(); typeof(FederationSitePublication).GetProperty("Revision")!.SetValue(publicationNoOp, long.MaxValue);
        publicationNoOp.SetActive(true, now);
        var identityNoOp = Identity(); typeof(LoginIdentity).GetProperty("SecurityVersion")!.SetValue(identityNoOp, long.MaxValue);
        identityNoOp.Update(identityNoOp.Username, true);
        if (noOp.Version != long.MaxValue || publicationNoOp.Revision != long.MaxValue || identityNoOp.SecurityVersion != long.MaxValue)
            throw new Exception("No-op mutation consumed a version.");
        var failures = Identity();
        for (var attempt = 1; attempt <= 20; attempt++)
        {
            failures.RecordAuthenticationFailure(now);
            if (failures.FailedAuthenticationCount != attempt || failures.IsAuthenticationLocked(now) != (attempt == 20))
                throw new Exception("Authentication lock threshold changed.");
        }
        typeof(LoginIdentity).GetProperty("FailedAuthenticationCount")!.SetValue(failures, int.MaxValue);
        failures.RecordAuthenticationFailure(now);
        if (failures.FailedAuthenticationCount != 20 || !failures.IsAuthenticationLocked(now)) throw new Exception("Failure count wrapped out of lockout.");
        var notification = new NotificationOutboxMessage(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "synthetic@example.invalid", "Synthetic", "Synthetic", "Synthetic", "Synthetic", now);
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            notification.Failed(now, "Synthetic failure");
            if (notification.Attempts != attempt || (notification.Status == "failed") != (attempt == 5)) throw new Exception("Notification retry threshold changed.");
        }
        typeof(NotificationOutboxMessage).GetProperty("Attempts")!.SetValue(notification, int.MaxValue);
        notification.Failed(now, "Synthetic failure");
        if (notification.Attempts != 5 || notification.Status != "failed" || notification.NextAttemptAt != now.AddMinutes(16))
            throw new Exception("Notification count overflow lost terminal state or bounded delay.");
        var link = new ExternalIdentityLink(Guid.NewGuid(), Guid.NewGuid(), "ldap", "", "synthetic", "synthetic", now);
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            link.RecordDirectoryMissing(now, 3);
            if (link.DirectoryMissingCount != attempt || link.DirectoryAccessEnabled != (attempt < 3)) throw new Exception("Directory confirmation threshold changed.");
        }
        typeof(ExternalIdentityLink).GetProperty("DirectoryMissingCount")!.SetValue(link, int.MaxValue);
        link.RecordDirectoryMissing(now, 3);
        if (link.DirectoryMissingCount != 3 || link.DirectoryAccessEnabled) throw new Exception("Directory missing count wrapped out of suspension.");
        Console.WriteLine($"Version boundary tests passed: {count} domain mutations accept the last version and reject exhaustion with unchanged state; no persistent deletion was performed.");
    }
}
