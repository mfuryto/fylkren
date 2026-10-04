using Fylkren.Api.Learning;
using Fylkren.Api.Organization;
using Fylkren.Api.Identity;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.WorkManagement;
using Fylkren.Api.Platform;
using Fylkren.Api.Notifications;
using Fylkren.Api.Decisions;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Risks;
using Fylkren.Api.Approvals;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

public sealed class FylkrenDbContext(DbContextOptions<FylkrenDbContext> options, FylkrenOptions? activityOptions = null, IHttpContextAccessor? activityHttp = null) : DbContext(options)
{
    internal List<WorkActivityIntent> PendingWorkActivities { get; } = [];
    internal string? ActivityRequestId => activityHttp?.HttpContext?.TraceIdentifier;
    internal Guid ActivityOperationId { get; } = Guid.NewGuid();
    public DbSet<Site> Sites => Set<Site>();
    internal DbSet<InstanceIdentity> InstanceIdentities => Set<InstanceIdentity>();
    internal DbSet<FederationPeer> FederationPeers => Set<FederationPeer>();
    internal DbSet<FederationRemoteSite> FederationRemoteSites => Set<FederationRemoteSite>();
    internal DbSet<FederationWorkLink> FederationWorkLinks => Set<FederationWorkLink>();
    internal DbSet<FederationInboundReceipt> FederationInboundReceipts => Set<FederationInboundReceipt>();
    internal DbSet<FederationOutboundMessage> FederationOutboundMessages => Set<FederationOutboundMessage>();
    internal DbSet<FederationSigningIdentity> FederationSigningIdentities => Set<FederationSigningIdentity>();
    internal DbSet<FederationProbeNonce> FederationProbeNonces => Set<FederationProbeNonce>();
    internal DbSet<FederationSitePublication> FederationSitePublications => Set<FederationSitePublication>();
    internal DbSet<FederationSiteGrant> FederationSiteGrants => Set<FederationSiteGrant>();
    internal DbSet<FederationRoutingSettings> FederationRoutingSettings => Set<FederationRoutingSettings>();
    internal DbSet<InstalledLicense> InstalledLicenses => Set<InstalledLicense>();
    public DbSet<OrganizationUnit> OrganizationUnits => Set<OrganizationUnit>();
    public DbSet<SiteManagerAssignment> SiteManagerAssignments => Set<SiteManagerAssignment>();
    public DbSet<SiteMembership> SiteMemberships => Set<SiteMembership>();
    public DbSet<OrganizationUnitMembership> OrganizationUnitMemberships => Set<OrganizationUnitMembership>();
    public DbSet<OrganizationRole> OrganizationRoles => Set<OrganizationRole>();
    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<LoginIdentity> LoginIdentities => Set<LoginIdentity>();
    public DbSet<PasswordResetGrant> PasswordResetGrants => Set<PasswordResetGrant>();
    public DbSet<ExternalIdentityLink> ExternalIdentityLinks => Set<ExternalIdentityLink>();
    public DbSet<WebAuthnCredential> WebAuthnCredentials => Set<WebAuthnCredential>();
    public DbSet<WebAuthnFlowGrant> WebAuthnFlowGrants => Set<WebAuthnFlowGrant>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Decision> Decisions => Set<Decision>();
    public DbSet<DecisionRevision> DecisionRevisions => Set<DecisionRevision>();
    public DbSet<DecisionMaker> DecisionMakers => Set<DecisionMaker>();
    public DbSet<DecisionReference> DecisionReferences => Set<DecisionReference>();
    public DbSet<EventProjection> EventProjections => Set<EventProjection>();
    public DbSet<Fylkren.Api.InformationLifecycle.InformationLifecycleRecord> InformationLifecycles => Set<Fylkren.Api.InformationLifecycle.InformationLifecycleRecord>();
    public DbSet<Fylkren.Api.Portability.ExportReceipt> ExportReceipts => Set<Fylkren.Api.Portability.ExportReceipt>();
    public DbSet<Fylkren.Api.InformationLifecycle.ArchiveGrant> ArchiveGrants => Set<Fylkren.Api.InformationLifecycle.ArchiveGrant>();
    public DbSet<Fylkren.Api.InformationLifecycle.LifecycleHold> LifecycleHolds => Set<Fylkren.Api.InformationLifecycle.LifecycleHold>();
    public DbSet<Fylkren.Api.InformationLifecycle.RetentionPolicyVersion> RetentionPolicyVersions => Set<Fylkren.Api.InformationLifecycle.RetentionPolicyVersion>();
    public DbSet<DomainEvent> DomainEvents => Set<DomainEvent>();
    public DbSet<WebhookSubscription> WebhookSubscriptions => Set<WebhookSubscription>();
    public DbSet<WebhookDelivery> WebhookDeliveries => Set<WebhookDelivery>();
    public DbSet<WebhookDeliveryAttempt> WebhookDeliveryAttempts => Set<WebhookDeliveryAttempt>();
    public DbSet<Risk> Risks => Set<Risk>(); public DbSet<RiskRevision> RiskRevisions => Set<RiskRevision>(); public DbSet<RiskMitigation> RiskMitigations => Set<RiskMitigation>(); public DbSet<RiskMitigationRevision> RiskMitigationRevisions => Set<RiskMitigationRevision>();
    public DbSet<DomainObjectVersion> DomainObjectVersions => Set<DomainObjectVersion>();
    public DbSet<FormalApprovalSignoff> FormalApprovalSignoffs => Set<FormalApprovalSignoff>();
    public DbSet<WorkItem> WorkItems => Set<WorkItem>();
    public DbSet<PlatformReferenceSettings> PlatformReferenceSettings => Set<PlatformReferenceSettings>();
    public DbSet<SiteReferenceSettings> SiteReferenceSettings => Set<SiteReferenceSettings>();
    public DbSet<LearningLesson> LearningLessons => Set<LearningLesson>();
    public DbSet<LearningEntry> LearningEntries => Set<LearningEntry>();
    public DbSet<WorkItemComment> WorkItemComments => Set<WorkItemComment>();
    public DbSet<WorkItemDependency> WorkItemDependencies => Set<WorkItemDependency>();
    public DbSet<WorkItemStateHistory> WorkItemStateHistory => Set<WorkItemStateHistory>();
    public DbSet<WorkItemType> WorkItemTypes => Set<WorkItemType>();
    public DbSet<WorkItemLookup> WorkItemLookups => Set<WorkItemLookup>();
    public DbSet<BrandingSettings> BrandingSettings => Set<BrandingSettings>();
    public DbSet<RegionalSettings> RegionalSettings => Set<RegionalSettings>();
    public DbSet<ClassificationSettings> ClassificationSettings => Set<ClassificationSettings>();
    public DbSet<ClassificationDefinition> ClassificationDefinitions => Set<ClassificationDefinition>();
    public DbSet<SmtpSettings> SmtpSettings => Set<SmtpSettings>();
    public DbSet<IdentityProviderSettings> IdentityProviderSettings => Set<IdentityProviderSettings>();
    public DbSet<SiteNotificationSettings> SiteNotificationSettings => Set<SiteNotificationSettings>();
    public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();
    public DbSet<NotificationOutboxMessage> NotificationOutboxMessages => Set<NotificationOutboxMessage>();
    public DbSet<NotificationProjectionCursor> NotificationProjectionCursors => Set<NotificationProjectionCursor>();
    public DbSet<PersonalNotificationSettings> PersonalNotificationSettings => Set<PersonalNotificationSettings>();
    public DbSet<ApiMachineIdentity> ApiMachineIdentities => Set<ApiMachineIdentity>();
    public DbSet<ApiMachineAuditEvent> ApiMachineAuditEvents => Set<ApiMachineAuditEvent>();
    public DbSet<ApiIdempotencyRecord> ApiIdempotencyRecords => Set<ApiIdempotencyRecord>();
    public DbSet<ApiReportGrant> ApiReportGrants => Set<ApiReportGrant>();
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<WorkflowRun> WorkflowRuns => Set<WorkflowRun>();
    public DbSet<WorkflowPlanAllocation> WorkflowPlanAllocations => Set<WorkflowPlanAllocation>();
    public DbSet<WorkflowPlanRequest> WorkflowPlanRequests => Set<WorkflowPlanRequest>();
    public DbSet<PlanningRfiEntry> PlanningRfiEntries => Set<PlanningRfiEntry>();
    public DbSet<WorkflowStepDocument> WorkflowStepDocuments => Set<WorkflowStepDocument>();
    public DbSet<WorkflowStepLink> WorkflowStepLinks => Set<WorkflowStepLink>();
    public DbSet<WorkflowStepTemplate> WorkflowStepTemplates => Set<WorkflowStepTemplate>();
    public DbSet<WorkflowTimelineEvent> WorkflowTimelineEvents => Set<WorkflowTimelineEvent>();
    public DbSet<ExecutionRun> ExecutionRuns => Set<ExecutionRun>();
    public DbSet<ExecutionStepDocument> ExecutionStepDocuments => Set<ExecutionStepDocument>();
    public DbSet<ExecutionExternalRequest> ExecutionExternalRequests => Set<ExecutionExternalRequest>();
    public DbSet<ExecutionTimelineEvent> ExecutionTimelineEvents => Set<ExecutionTimelineEvent>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        var pendingReferences = PendingReferences();
        using var transaction = Database.CurrentTransaction is null
            ? Database.BeginTransaction()
            : null;
        try
        {
            Database.ExecuteSqlRaw("SELECT set_config('fylkren.activity_writer', '1', true)");
            if (PendingWorkActivities.Count > 0 || ChangeTracker.Entries<WorkItem>().Any(e => e.State == EntityState.Modified && e.Property(w => w.Status).IsModified && e.Property(w => w.Status).OriginalValue != e.Entity.Status && Fylkren.Api.InformationLifecycle.WorkLifecyclePolicy.Terminal(e.Entity.Status))) throw new InvalidOperationException("Work activity requires asynchronous transactional save.");
            if (pendingReferences.Length > 0) AssignReferences(pendingReferences);
            ProtectActivityFacts();
            ProtectFormalApprovalHistory();
            SnapshotAuditActors();
            var result = base.SaveChanges(acceptAllChangesOnSuccess);
            transaction?.Commit();
            return result;
        }
        catch
        {
            transaction?.Rollback();
            throw;
        }
    }

    public override async Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        var pendingReferences = PendingReferences();
        var terminalChanges = ChangeTracker.Entries<WorkItem>().Where(e => e.State == EntityState.Modified &&
            e.Property(w => w.Status).IsModified && e.Property(w => w.Status).OriginalValue != e.Entity.Status &&
            Fylkren.Api.InformationLifecycle.WorkLifecyclePolicy.Terminal(e.Entity.Status)).Select(e => e.Entity).ToArray();
        await using var transaction = Database.CurrentTransaction is null
            ? await Database.BeginTransactionAsync(cancellationToken)
            : null;
        try
        {
            await Database.ExecuteSqlRawAsync("SELECT set_config('fylkren.activity_writer', '1', true)", cancellationToken);
            if (pendingReferences.Length > 0)
                await AssignReferencesAsync(pendingReferences, cancellationToken);
            ProtectActivityFacts();
            ProtectFormalApprovalHistory();
            await WorkActivity.Prepare(this, cancellationToken);
            await SnapshotAuditActorsAsync(cancellationToken);
            var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            if (PendingWorkActivities.Count > 0)
            {
                await WorkActivity.ProjectNotifications(this, activityOptions?.PublicUrl ?? "http://localhost:8080", cancellationToken);
                await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            }
            foreach (var item in terminalChanges)
            {
                var lifecycle = await InformationLifecycles.SingleOrDefaultAsync(l => l.ResourceType == "work_item" && l.ResourceId == item.Id, cancellationToken);
                lifecycle?.SetAutomationPaused(false);
                await Fylkren.Api.InformationLifecycle.WorkLifecycleAutomation.Advance(item, this, false, cancellationToken);
            }
            if (terminalChanges.Length > 0) await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            if (transaction is not null) await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ConfigureOrganizationIdentity();
        modelBuilder.ConfigureAudit();
        modelBuilder.ConfigureWorkItems();
        modelBuilder.ConfigureWorkItemComments();
        modelBuilder.ConfigureLearning();
        modelBuilder.ConfigureDecisions();
        modelBuilder.ConfigureDomainEvents();
        modelBuilder.ConfigureActivityFoundation();
        modelBuilder.ConfigureLifecycleGovernance();
        modelBuilder.ConfigureRisks();
        modelBuilder.ConfigureFormalApprovals();
        modelBuilder.ConfigurePlatform();
        modelBuilder.ConfigureNotifications();
        modelBuilder.ConfigureApi();
        modelBuilder.ConfigureWorkflows();
    }

    private void ProtectActivityFacts()
    {
        if (ChangeTracker.Entries<DomainEvent>().Any(entry => entry.State == EntityState.Deleted ||
            entry.State == EntityState.Modified && entry.Properties.Any(property => property.IsModified && property.Metadata.Name != nameof(DomainEvent.WebhooksProjectedAt))))
            throw new InvalidOperationException("Domain activity facts are immutable.");
    }

    private void ProtectFormalApprovalHistory()
    {
        if (ChangeTracker.Entries<DomainObjectVersion>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted) ||
            ChangeTracker.Entries<FormalApprovalSignoff>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Formal approval history is immutable. Create a new version or sign-off instead.");
    }

    private WorkItem[] PendingReferences() => ChangeTracker.Entries<WorkItem>()
        .Where(entry => entry.State == EntityState.Added && string.IsNullOrEmpty(entry.Entity.ReferenceCode))
        .Select(entry => entry.Entity)
        .OrderBy(item => item.CreatedAt)
        .ThenBy(item => item.Id)
        .ToArray();

    private void AssignReferences(IEnumerable<WorkItem> pending)
    {
        var items = pending.ToList();
        var platform = PlatformReferenceSettings
            .FromSqlRaw("SELECT * FROM platform_reference_settings WHERE key = 1 FOR UPDATE").Single();
        var typeIds = items.Where(item => item.ParentWorkItemId is null && item.WorkItemTypeId is not null)
            .Select(item => item.WorkItemTypeId!.Value).Distinct().ToArray();
        var typePrefixes = WorkItemTypes.AsNoTracking().Where(type => typeIds.Contains(type.Id))
            .ToDictionary(type => type.Id, type => type.Abbreviation);
        foreach (var group in items.Where(item => item.ParentWorkItemId is null)
                     .GroupBy(item => item.SiteId).OrderBy(group => group.Key))
        {
            var settings = ChangeTracker.Entries<SiteReferenceSettings>()
                .Where(entry => entry.State == EntityState.Added && entry.Entity.SiteId == group.Key)
                .Select(entry => entry.Entity)
                .SingleOrDefault() ?? SiteReferenceSettings
                .FromSqlInterpolated($"SELECT * FROM site_reference_settings WHERE site_id = {group.Key} FOR UPDATE")
                .Single();
            foreach (var item in group)
            {
                var number = platform.Reserve();
                var prefix = item.WorkItemTypeId is Guid typeId && typePrefixes.TryGetValue(typeId, out var typePrefix)
                    ? typePrefix : settings.Prefix;
                item.AssignReference(ReferenceCodePolicy.Format(
                    prefix, number, platform.MinimumDigits), number);
            }
        }
        AssignChildReferences(items);
    }

    private async Task AssignReferencesAsync(IEnumerable<WorkItem> pending, CancellationToken cancellationToken)
    {
        var items = pending.ToList();
        var platform = await PlatformReferenceSettings
            .FromSqlRaw("SELECT * FROM platform_reference_settings WHERE key = 1 FOR UPDATE")
            .SingleAsync(cancellationToken);
        var typeIds = items.Where(item => item.ParentWorkItemId is null && item.WorkItemTypeId is not null)
            .Select(item => item.WorkItemTypeId!.Value).Distinct().ToArray();
        var typePrefixes = await WorkItemTypes.AsNoTracking().Where(type => typeIds.Contains(type.Id))
            .ToDictionaryAsync(type => type.Id, type => type.Abbreviation, cancellationToken);
        foreach (var group in items.Where(item => item.ParentWorkItemId is null)
                     .GroupBy(item => item.SiteId).OrderBy(group => group.Key))
        {
            var settings = ChangeTracker.Entries<SiteReferenceSettings>()
                .Where(entry => entry.State == EntityState.Added && entry.Entity.SiteId == group.Key)
                .Select(entry => entry.Entity)
                .SingleOrDefault();
            settings ??= await SiteReferenceSettings
                .FromSqlInterpolated($"SELECT * FROM site_reference_settings WHERE site_id = {group.Key} FOR UPDATE")
                .SingleAsync(cancellationToken);
            foreach (var item in group)
            {
                var number = platform.Reserve();
                var prefix = item.WorkItemTypeId is Guid typeId && typePrefixes.TryGetValue(typeId, out var typePrefix)
                    ? typePrefix : settings.Prefix;
                item.AssignReference(ReferenceCodePolicy.Format(
                    prefix, number, platform.MinimumDigits), number);
            }
        }
        await AssignChildReferencesAsync(items, cancellationToken);
    }

    private void AssignChildReferences(IReadOnlyCollection<WorkItem> pending)
    {
        var remaining = pending.Where(item => item.ParentWorkItemId is not null &&
            string.IsNullOrEmpty(item.ReferenceCode)).ToList();
        while (remaining.Count > 0)
        {
            var progressed = false;
            foreach (var group in remaining.GroupBy(item => item.ParentWorkItemId!.Value).ToList())
            {
                var parentEntry = ChangeTracker.Entries<WorkItem>()
                    .SingleOrDefault(entry => entry.Entity.Id == group.Key);
                var parent = parentEntry?.Entity;
                if (parentEntry?.State != EntityState.Added)
                {
                    var lockedParent = WorkItems.FromSqlInterpolated(
                        $"SELECT *, xmin FROM work_items WHERE id = {group.Key} FOR UPDATE")
                        .AsNoTracking().Single();
                    parent ??= lockedParent;
                }
                if (parent is null) throw new InvalidOperationException("The parent task does not exist.");
                if (string.IsNullOrEmpty(parent.ReferenceCode)) continue;
                var next = WorkItems.AsNoTracking().Where(item => item.ParentWorkItemId == group.Key)
                    .Select(item => (long?)item.ReferenceNumber).Max() ?? 0;
                foreach (var item in group.OrderBy(item => item.CreatedAt).ThenBy(item => item.Id))
                {
                    next++;
                    item.AssignReference($"{parent.ReferenceCode}-{next}", next);
                    remaining.Remove(item);
                }
                progressed = true;
            }
            if (!progressed) throw new InvalidOperationException("A parent reference is required before a child reference can be assigned.");
        }
    }

    private async Task AssignChildReferencesAsync(IReadOnlyCollection<WorkItem> pending,
        CancellationToken cancellationToken)
    {
        var remaining = pending.Where(item => item.ParentWorkItemId is not null &&
            string.IsNullOrEmpty(item.ReferenceCode)).ToList();
        while (remaining.Count > 0)
        {
            var progressed = false;
            foreach (var group in remaining.GroupBy(item => item.ParentWorkItemId!.Value).ToList())
            {
                var parentEntry = ChangeTracker.Entries<WorkItem>()
                    .SingleOrDefault(entry => entry.Entity.Id == group.Key);
                var parent = parentEntry?.Entity;
                if (parentEntry?.State != EntityState.Added)
                {
                    var lockedParent = await WorkItems.FromSqlInterpolated(
                        $"SELECT *, xmin FROM work_items WHERE id = {group.Key} FOR UPDATE")
                        .AsNoTracking()
                        .SingleAsync(cancellationToken);
                    parent ??= lockedParent;
                }
                if (parent is null) throw new InvalidOperationException("The parent task does not exist.");
                if (string.IsNullOrEmpty(parent.ReferenceCode)) continue;
                var next = await WorkItems.AsNoTracking()
                    .Where(item => item.ParentWorkItemId == group.Key)
                    .Select(item => (long?)item.ReferenceNumber).MaxAsync(cancellationToken) ?? 0;
                foreach (var item in group.OrderBy(item => item.CreatedAt).ThenBy(item => item.Id))
                {
                    next++;
                    item.AssignReference($"{parent.ReferenceCode}-{next}", next);
                    remaining.Remove(item);
                }
                progressed = true;
            }
            if (!progressed) throw new InvalidOperationException("A parent reference is required before a child reference can be assigned.");
        }
    }

    internal async Task AssignPendingWorkItemReferencesAsync(CancellationToken cancellationToken)
    {
        var pending = PendingReferences();
        if (pending.Length == 0) return;
        if (Database.CurrentTransaction is null)
            throw new InvalidOperationException("Immediate task-reference allocation requires a transaction.");
        await AssignReferencesAsync(pending, cancellationToken);
    }

    private IReadOnlySet<Guid> PlatformManagerIds(IEnumerable<Guid> actorIds) =>
        LoginIdentities.AsNoTracking()
            .Where(value => actorIds.Contains(value.PersonId) && value.IsPlatformManager)
            .Select(value => value.PersonId)
            .ToHashSet();

    private async Task<IReadOnlySet<Guid>> PlatformManagerIdsAsync(
        IEnumerable<Guid> actorIds,
        CancellationToken cancellationToken) =>
        (await LoginIdentities.AsNoTracking()
            .Where(value => actorIds.Contains(value.PersonId) && value.IsPlatformManager)
            .Select(value => value.PersonId)
            .ToListAsync(cancellationToken))
        .ToHashSet();

    private void SnapshotAuditActors()
    {
        var added = ChangeTracker.Entries<AuditEvent>()
            .Where(entry => entry.State == EntityState.Added)
            .Select(entry => entry.Entity)
            .ToArray();
        if (added.Length == 0) return;
        var platformManagers = PlatformManagerIds(added.Where(value => value.ActorPersonId.HasValue)
            .Select(value => value.ActorPersonId!.Value).Distinct().ToArray());
        foreach (var auditEvent in added)
            auditEvent.SnapshotActorRole(auditEvent.ActorPersonId is Guid actorId && platformManagers.Contains(actorId));
    }

    private async Task SnapshotAuditActorsAsync(CancellationToken cancellationToken)
    {
        var added = ChangeTracker.Entries<AuditEvent>()
            .Where(entry => entry.State == EntityState.Added)
            .Select(entry => entry.Entity)
            .ToArray();
        if (added.Length == 0) return;
        var platformManagers = await PlatformManagerIdsAsync(
            added.Where(value => value.ActorPersonId.HasValue)
                .Select(value => value.ActorPersonId!.Value).Distinct().ToArray(), cancellationToken);
        foreach (var auditEvent in added)
            auditEvent.SnapshotActorRole(auditEvent.ActorPersonId is Guid actorId && platformManagers.Contains(actorId));
    }
}
