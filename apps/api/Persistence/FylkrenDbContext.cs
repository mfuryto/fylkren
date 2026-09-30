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

public sealed class FylkrenDbContext(DbContextOptions<FylkrenDbContext> options) : DbContext(options)
{
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
    public DbSet<DomainEvent> DomainEvents => Set<DomainEvent>();
    public DbSet<WebhookSubscription> WebhookSubscriptions => Set<WebhookSubscription>();
    public DbSet<WebhookDelivery> WebhookDeliveries => Set<WebhookDelivery>();
    public DbSet<WebhookDeliveryAttempt> WebhookDeliveryAttempts => Set<WebhookDeliveryAttempt>();
    public DbSet<Risk> Risks => Set<Risk>(); public DbSet<RiskRevision> RiskRevisions => Set<RiskRevision>(); public DbSet<RiskMitigation> RiskMitigations => Set<RiskMitigation>(); public DbSet<RiskMitigationRevision> RiskMitigationRevisions => Set<RiskMitigationRevision>();
    public DbSet<DomainObjectVersion> DomainObjectVersions => Set<DomainObjectVersion>();
    public DbSet<FormalApprovalSignoff> FormalApprovalSignoffs => Set<FormalApprovalSignoff>();
    public DbSet<WorkItem> WorkItems => Set<WorkItem>();
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
        ProtectFormalApprovalHistory();
        SnapshotAuditActors();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override async Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        ProtectFormalApprovalHistory();
        await SnapshotAuditActorsAsync(cancellationToken);
        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ConfigureOrganizationIdentity();
        modelBuilder.ConfigureAudit();
        modelBuilder.ConfigureWorkItems();
        modelBuilder.ConfigureDecisions();
        modelBuilder.ConfigureDomainEvents();
        modelBuilder.ConfigureRisks();
        modelBuilder.ConfigureFormalApprovals();
        modelBuilder.ConfigurePlatform();
        modelBuilder.ConfigureNotifications();
        modelBuilder.ConfigureApi();
        modelBuilder.ConfigureWorkflows();
    }

    private void ProtectFormalApprovalHistory()
    {
        if (ChangeTracker.Entries<DomainObjectVersion>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted) ||
            ChangeTracker.Entries<FormalApprovalSignoff>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Formal approval history is immutable. Create a new version or sign-off instead.");
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
