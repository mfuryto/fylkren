using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Notifications;
using Fylkren.Api.Organization;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class OrganizationIdentityModelConfiguration
{
    internal static void ConfigureOrganizationIdentity(this ModelBuilder modelBuilder)
    {
        var site = modelBuilder.Entity<Site>();
        site.ToTable("sites");
        site.HasKey(value => value.Id);
        site.Property(value => value.Id).HasColumnName("id");
        site.Property(value => value.ParentOrganizationUnitId).HasColumnName("parent_organization_unit_id");
        site.Property(value => value.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        site.Property(value => value.NormalizedName).HasColumnName("normalized_name").HasMaxLength(200).IsRequired();
        site.Property(value => value.IsActive).HasColumnName("is_active");
        site.Property(value => value.CreatedAt).HasColumnName("created_at");
        site.Property(value => value.FinalReportTemplate).HasColumnName("final_report_template").HasMaxLength(20000);
        site.Property(value => value.OverviewDesign).HasColumnName("overview_design").HasMaxLength(20).IsRequired();
        site.Property(value => value.Version).HasColumnName("version").HasDefaultValue(1L).IsConcurrencyToken();
        site.HasIndex(value => value.NormalizedName).IsUnique();
        site.HasOne(value => value.ParentOrganizationUnit).WithMany(value => value.AttachedSites).HasForeignKey(value => value.ParentOrganizationUnitId).OnDelete(DeleteBehavior.Restrict);

        var classificationSettings = modelBuilder.Entity<ClassificationSettings>();
        classificationSettings.ToTable("classification_settings");
        classificationSettings.HasKey(value => value.Id);
        classificationSettings.Property(value => value.Id).HasColumnName("id");
        classificationSettings.Property(value => value.IsEnabled).HasColumnName("is_enabled");

        var classification = modelBuilder.Entity<ClassificationDefinition>();
        classification.ToTable("classification_definitions");
        classification.HasKey(value => value.Id);
        classification.Property(value => value.Id).HasColumnName("id");
        classification.Property(value => value.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        classification.Property(value => value.Abbreviation).HasColumnName("abbreviation").HasMaxLength(12).IsRequired();
        classification.Property(value => value.SortOrder).HasColumnName("sort_order");
        classification.Property(value => value.IsActive).HasColumnName("is_active");
        classification.HasIndex(value => value.Abbreviation).IsUnique();

        var unit = modelBuilder.Entity<OrganizationUnit>();
        unit.ToTable("organization_units");
        unit.HasKey(value => value.Id);
        unit.Property(value => value.Id).HasColumnName("id");
        unit.Property(value => value.SiteId).HasColumnName("site_id");
        unit.Property(value => value.ParentId).HasColumnName("parent_id");
        unit.Property(value => value.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        unit.Property(value => value.NormalizedName).HasColumnName("normalized_name").HasMaxLength(200).IsRequired();
        unit.Property(value => value.IsTemporary).HasColumnName("is_temporary");
        unit.Property(value => value.IsSiteRoot).HasColumnName("is_site_root");
        unit.Property(value => value.WorksAtParentLevel).HasColumnName("works_at_parent_level");
        unit.Property(value => value.IsSiteLeadership).HasColumnName("is_site_leadership");
        unit.Property(value => value.IsActive).HasColumnName("is_active");
        unit.Property(value => value.SortOrder).HasColumnName("sort_order");
        unit.Property(value => value.CreatedAt).HasColumnName("created_at");
        unit.HasIndex(value => new { value.SiteId, value.NormalizedName }).IsUnique().HasFilter("parent_id IS NULL");
        unit.HasIndex(value => new { value.SiteId, value.ParentId, value.NormalizedName }).IsUnique().HasFilter("parent_id IS NOT NULL");
        unit.HasIndex(value => new { value.SiteId, value.IsSiteRoot }).IsUnique().HasFilter("is_site_root");
        unit.HasIndex(value => value.SiteId).IsUnique().HasFilter("is_site_leadership").HasDatabaseName("ix_organization_units_one_site_leadership");
        unit.HasOne(value => value.Site)
            .WithMany(value => value.OrganizationUnits)
            .HasForeignKey(value => value.SiteId)
            .OnDelete(DeleteBehavior.Restrict);
        unit.HasOne(value => value.Parent)
            .WithMany(value => value.Children)
            .HasForeignKey(value => value.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        var person = modelBuilder.Entity<Person>();
        person.ToTable("people");
        person.HasKey(value => value.Id);
        person.Property(value => value.Id).HasColumnName("id");
        person.Property(value => value.DisplayName).HasColumnName("display_name").HasMaxLength(200).IsRequired();
        person.Property(value => value.Email).HasColumnName("email").HasMaxLength(320);
        person.Property(value => value.NormalizedEmail).HasColumnName("normalized_email").HasMaxLength(320);
        person.Property(value => value.IsActive).HasColumnName("is_active");
        person.Property(value => value.IsDeleted).HasColumnName("is_deleted");
        person.Property(value => value.DeletedAt).HasColumnName("deleted_at");
        person.Property(value => value.ProfileImage).HasColumnName("profile_image");
        person.Property(value => value.ProfileImageContentType).HasColumnName("profile_image_content_type").HasMaxLength(50);
        person.Property(value => value.CreatedAt).HasColumnName("created_at");
        person.HasIndex(value => value.NormalizedEmail).IsUnique();

        var identity = modelBuilder.Entity<LoginIdentity>();
        identity.ToTable("login_identities");
        identity.HasKey(value => value.Id);
        identity.Property(value => value.Id).HasColumnName("id");
        identity.Property(value => value.PersonId).HasColumnName("person_id");
        identity.Property(value => value.Username).HasColumnName("username").HasMaxLength(100).IsRequired();
        identity.Property(value => value.NormalizedUsername).HasColumnName("normalized_username").HasMaxLength(100).IsRequired();
        identity.Property(value => value.PasswordHash).HasColumnName("password_hash").IsRequired();
        identity.Property(value => value.IsPlatformManager).HasColumnName("is_platform_manager");
        identity.Property(value => value.MustChangePassword).HasColumnName("must_change_password");
        identity.Property(value => value.SecurityVersion).HasColumnName("security_version").HasDefaultValue(0L);
        identity.Property(value => value.TotpSecret).HasColumnName("totp_secret");
        identity.Property(value => value.RecoveryCodeHashes).HasColumnName("recovery_code_hashes");
        identity.Property(value => value.LastTotpTimeStep).HasColumnName("last_totp_time_step");
        identity.Property(value => value.TotpEnabled).HasColumnName("totp_enabled");
        identity.Property(value => value.IsActive).HasColumnName("is_active");
        identity.Property(value => value.CreatedAt).HasColumnName("created_at");
        identity.Property(value => value.LastSignedInAt).HasColumnName("last_signed_in_at");
        identity.Property(value => value.FailedAuthenticationCount).HasColumnName("failed_authentication_count").HasDefaultValue(0);
        identity.Property(value => value.AuthenticationLockedUntil).HasColumnName("authentication_locked_until");
        identity.HasIndex(value => value.NormalizedUsername).IsUnique();
        identity.HasOne(value => value.Person).WithMany(value => value.LoginIdentities).HasForeignKey(value => value.PersonId).OnDelete(DeleteBehavior.Restrict);

        var browserSession = modelBuilder.Entity<BrowserSession>();
        browserSession.ToTable("browser_sessions");
        browserSession.HasKey(value => value.Id);
        browserSession.Property(value => value.Id).HasColumnName("id");
        browserSession.Property(value => value.LoginIdentityId).HasColumnName("login_identity_id");
        browserSession.Property(value => value.SecurityVersion).HasColumnName("security_version");
        browserSession.Property(value => value.AuthenticationMethod).HasColumnName("authentication_method").HasMaxLength(40).IsRequired();
        browserSession.Property(value => value.UserAgent).HasColumnName("user_agent").HasMaxLength(300).IsRequired();
        browserSession.Property(value => value.CreatedAt).HasColumnName("created_at");
        browserSession.Property(value => value.LastSeenAt).HasColumnName("last_seen_at");
        browserSession.Property(value => value.ExpiresAt).HasColumnName("expires_at");
        browserSession.Property(value => value.RevokedAt).HasColumnName("revoked_at");
        browserSession.HasIndex(value => new { value.LoginIdentityId, value.RevokedAt, value.ExpiresAt });
        browserSession.HasOne(value => value.LoginIdentity).WithMany().HasForeignKey(value => value.LoginIdentityId).OnDelete(DeleteBehavior.Restrict);

        var passwordResetGrant = modelBuilder.Entity<PasswordResetGrant>();
        passwordResetGrant.ToTable("password_reset_grants");
        passwordResetGrant.HasKey(value => value.Id);
        passwordResetGrant.Property(value => value.Id).HasColumnName("id");
        passwordResetGrant.Property(value => value.LoginIdentityId).HasColumnName("login_identity_id");
        passwordResetGrant.Property(value => value.CreatedByPersonId).HasColumnName("created_by_person_id");
        passwordResetGrant.Property(value => value.CodeHash).HasColumnName("code_hash").IsRequired();
        passwordResetGrant.Property(value => value.CreatedAt).HasColumnName("created_at");
        passwordResetGrant.Property(value => value.ExpiresAt).HasColumnName("expires_at");
        passwordResetGrant.Property(value => value.ConsumedAt).HasColumnName("consumed_at");
        passwordResetGrant.Property(value => value.RevokedAt).HasColumnName("revoked_at");
        passwordResetGrant.HasIndex(value => new { value.LoginIdentityId, value.ExpiresAt });
        passwordResetGrant.HasIndex(value => value.CodeHash).IsUnique();
        passwordResetGrant.HasOne(value => value.LoginIdentity).WithMany().HasForeignKey(value => value.LoginIdentityId).OnDelete(DeleteBehavior.Restrict);

        var externalIdentity = modelBuilder.Entity<ExternalIdentityLink>();
        externalIdentity.ToTable("external_identity_links");
        externalIdentity.HasKey(value => value.Id);
        externalIdentity.Property(value => value.Id).HasColumnName("id");
        externalIdentity.Property(value => value.PersonId).HasColumnName("person_id");
        externalIdentity.Property(value => value.Provider).HasColumnName("provider").HasMaxLength(30).IsRequired();
        externalIdentity.Property(value => value.ProviderInstanceId).HasColumnName("provider_instance_id").HasMaxLength(1000).HasDefaultValue("").IsRequired();
        externalIdentity.Property(value => value.SubjectId).HasColumnName("subject_id").HasMaxLength(256).IsRequired();
        externalIdentity.Property(value => value.Username).HasColumnName("username").HasMaxLength(256);
        externalIdentity.Property(value => value.IsActive).HasColumnName("is_active");
        externalIdentity.Property(value => value.CreatedAt).HasColumnName("created_at");
        externalIdentity.Property(value => value.ProvisionedAt).HasColumnName("provisioned_at");
        externalIdentity.Property(value => value.DirectoryAccessEnabled).HasColumnName("directory_access_enabled").HasDefaultValue(true);
        externalIdentity.Property(value => value.DirectoryLifecycleStatus).HasColumnName("directory_lifecycle_status").HasMaxLength(30).HasDefaultValue("pending").IsRequired();
        externalIdentity.Property(value => value.DirectoryMissingCount).HasColumnName("directory_missing_count").HasDefaultValue(0);
        externalIdentity.Property(value => value.DirectoryLastCheckedAt).HasColumnName("directory_last_checked_at");
        externalIdentity.Property(value => value.DirectoryLastSuccessfulSyncAt).HasColumnName("directory_last_successful_sync_at");
        externalIdentity.Property(value => value.DirectorySuspendedAt).HasColumnName("directory_suspended_at");
        externalIdentity.HasIndex(value => new { value.Provider, value.ProviderInstanceId, value.SubjectId }).IsUnique();
        externalIdentity.HasOne(value => value.Person).WithMany(value => value.ExternalIdentityLinks).HasForeignKey(value => value.PersonId).OnDelete(DeleteBehavior.Restrict);

        var provisioningIssue = modelBuilder.Entity<ExternalIdentityProvisioningIssue>();
        provisioningIssue.ToTable("external_identity_provisioning_issues");
        provisioningIssue.HasKey(value => value.Id);
        provisioningIssue.Property(value => value.Id).HasColumnName("id");
        provisioningIssue.Property(value => value.Provider).HasColumnName("provider").HasMaxLength(30).IsRequired();
        provisioningIssue.Property(value => value.ProviderInstanceId).HasColumnName("provider_instance_id").HasMaxLength(1000).IsRequired();
        provisioningIssue.Property(value => value.SubjectId).HasColumnName("subject_id").HasMaxLength(256).IsRequired();
        provisioningIssue.Property(value => value.Username).HasColumnName("username").HasMaxLength(256);
        provisioningIssue.Property(value => value.DisplayName).HasColumnName("display_name").HasMaxLength(200);
        provisioningIssue.Property(value => value.Email).HasColumnName("email").HasMaxLength(320);
        provisioningIssue.Property(value => value.Reason).HasColumnName("reason").HasMaxLength(50).IsRequired();
        provisioningIssue.Property(value => value.FirstSeenAt).HasColumnName("first_seen_at");
        provisioningIssue.Property(value => value.LastSeenAt).HasColumnName("last_seen_at");
        provisioningIssue.Property(value => value.ResolvedAt).HasColumnName("resolved_at");
        provisioningIssue.HasIndex(value => new { value.Provider, value.ProviderInstanceId, value.SubjectId }).IsUnique();
        provisioningIssue.HasIndex(value => new { value.ResolvedAt, value.LastSeenAt });

        var webAuthn = modelBuilder.Entity<WebAuthnCredential>();
        webAuthn.ToTable("webauthn_credentials");
        webAuthn.HasKey(x => x.Id);
        webAuthn.Property(x => x.Id).HasColumnName("id");
        webAuthn.Property(x => x.PersonId).HasColumnName("person_id");
        webAuthn.Property(x => x.CredentialId).HasColumnName("credential_id");
        webAuthn.Property(x => x.PublicKey).HasColumnName("public_key");
        webAuthn.Property(x => x.UserHandle).HasColumnName("user_handle");
        webAuthn.Property(x => x.SignCount).HasColumnName("sign_count");
        webAuthn.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        webAuthn.Property(x => x.IsActive).HasColumnName("is_active");
        webAuthn.Property(x => x.CreatedAt).HasColumnName("created_at");
        webAuthn.Property(x => x.LastUsedAt).HasColumnName("last_used_at");
        webAuthn.HasIndex(x => x.CredentialId).IsUnique();
        webAuthn.HasOne(x => x.Person)
            .WithMany(x => x.WebAuthnCredentials)
            .HasForeignKey(x => x.PersonId)
            .OnDelete(DeleteBehavior.Restrict);

        var webAuthnFlow = modelBuilder.Entity<WebAuthnFlowGrant>();
        webAuthnFlow.ToTable("webauthn_flow_grants");
        webAuthnFlow.HasKey(value => value.Id);
        webAuthnFlow.Property(value => value.Id).HasColumnName("id");
        webAuthnFlow.Property(value => value.Purpose).HasColumnName("purpose").HasMaxLength(20).IsRequired();
        webAuthnFlow.Property(value => value.CreatedAt).HasColumnName("created_at");
        webAuthnFlow.Property(value => value.ExpiresAt).HasColumnName("expires_at");
        webAuthnFlow.Property(value => value.ConsumedAt).HasColumnName("consumed_at");
        webAuthnFlow.HasIndex(value => value.ExpiresAt);

        var siteManager = modelBuilder.Entity<SiteManagerAssignment>();
        siteManager.ToTable("site_manager_assignments");
        siteManager.HasKey(value => value.Id);
        siteManager.Property(value => value.Id).HasColumnName("id");
        siteManager.Property(value => value.SiteId).HasColumnName("site_id");
        siteManager.Property(value => value.PersonId).HasColumnName("person_id");
        siteManager.Property(value => value.IsActive).HasColumnName("is_active");
        siteManager.Property(value => value.CreatedAt).HasColumnName("created_at");
        siteManager.HasIndex(value => new { value.SiteId, value.PersonId }).IsUnique();
        siteManager.HasOne(value => value.Site).WithMany(value => value.ManagerAssignments).HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        siteManager.HasOne(value => value.Person).WithMany(value => value.SiteManagerAssignments).HasForeignKey(value => value.PersonId).OnDelete(DeleteBehavior.Restrict);

        var membership = modelBuilder.Entity<SiteMembership>();
        membership.ToTable("site_memberships");
        membership.HasKey(value => value.Id);
        membership.Property(value => value.Id).HasColumnName("id");
        membership.Property(value => value.SiteId).HasColumnName("site_id");
        membership.Property(value => value.PersonId).HasColumnName("person_id");
        membership.Property(value => value.IsActive).HasColumnName("is_active");
        membership.Property(value => value.CreatedAt).HasColumnName("created_at");
        membership.HasIndex(value => new { value.SiteId, value.PersonId }).IsUnique();
        membership.HasOne(value => value.Site).WithMany(value => value.Memberships).HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        membership.HasOne(value => value.Person).WithMany(value => value.SiteMemberships).HasForeignKey(value => value.PersonId).OnDelete(DeleteBehavior.Restrict);

        var unitMembership = modelBuilder.Entity<OrganizationUnitMembership>();
        unitMembership.ToTable("organization_unit_memberships");
        unitMembership.HasKey(value => value.Id);
        unitMembership.Property(value => value.Id).HasColumnName("id");
        unitMembership.Property(value => value.SiteId).HasColumnName("site_id");
        unitMembership.Property(value => value.OrganizationUnitId).HasColumnName("organization_unit_id");
        unitMembership.Property(value => value.PersonId).HasColumnName("person_id");
        unitMembership.Property(value => value.CreatedAt).HasColumnName("created_at");
        unitMembership.HasIndex(value => new { value.SiteId, value.PersonId }).IsUnique();
        unitMembership.HasOne(value => value.Site).WithMany(value => value.OrganizationUnitMemberships).HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
        unitMembership.HasOne(value => value.OrganizationUnit).WithMany(value => value.Memberships).HasForeignKey(value => value.OrganizationUnitId).OnDelete(DeleteBehavior.Restrict);
        unitMembership.HasOne(value => value.Person).WithMany(value => value.OrganizationUnitMemberships).HasForeignKey(value => value.PersonId).OnDelete(DeleteBehavior.Restrict);

        var role = modelBuilder.Entity<OrganizationRole>();
        role.ToTable("organization_roles");
        role.HasKey(value => value.Id);
        role.Property(value => value.Id).HasColumnName("id");
        role.Property(value => value.OrganizationUnitId).HasColumnName("organization_unit_id");
        role.Property(value => value.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        role.Property(value => value.NormalizedName).HasColumnName("normalized_name").HasMaxLength(200).IsRequired();
        role.Property(value => value.IsLeader).HasColumnName("is_leader");
        role.Property(value => value.HasLeaderAccess).HasColumnName("has_leader_access");
        role.Property(value => value.CanPlan).HasColumnName("can_plan");
        role.Property(value => value.IsActive).HasColumnName("is_active");
        role.Property(value => value.CreatedAt).HasColumnName("created_at");
        role.HasIndex(value => new { value.OrganizationUnitId, value.NormalizedName }).IsUnique();
        role.HasIndex(value => value.OrganizationUnitId).IsUnique().HasFilter("is_leader");
        role.HasOne(value => value.OrganizationUnit).WithMany(value => value.Roles).HasForeignKey(value => value.OrganizationUnitId).OnDelete(DeleteBehavior.Restrict);

        var assignment = modelBuilder.Entity<RoleAssignment>();
        assignment.ToTable("role_assignments");
        assignment.HasKey(value => value.Id);
        assignment.Property(value => value.Id).HasColumnName("id");
        assignment.Property(value => value.RoleId).HasColumnName("role_id");
        assignment.Property(value => value.PersonId).HasColumnName("person_id");
        assignment.Property(value => value.ValidFrom).HasColumnName("valid_from");
        assignment.Property(value => value.ValidTo).HasColumnName("valid_to");
        assignment.Property(value => value.IsActive).HasColumnName("is_active");
        assignment.Property(value => value.CanLeadParentLevel).HasColumnName("can_lead_parent_level");
        assignment.Property(value => value.CreatedAt).HasColumnName("created_at");
        assignment.HasIndex(value => new { value.RoleId, value.PersonId, value.ValidFrom }).IsUnique();
        assignment.HasIndex(value => new { value.PersonId, value.IsActive, value.ValidFrom, value.ValidTo });
        assignment.HasOne(value => value.Role).WithMany(value => value.Assignments).HasForeignKey(value => value.RoleId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(value => value.Person).WithMany(value => value.RoleAssignments).HasForeignKey(value => value.PersonId).OnDelete(DeleteBehavior.Restrict);
    }
}
