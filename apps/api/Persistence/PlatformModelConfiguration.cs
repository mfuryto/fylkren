using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Notifications;
using Fylkren.Api.Organization;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class PlatformModelConfiguration
{
    internal static void ConfigurePlatform(this ModelBuilder modelBuilder)
    {
        var instance = modelBuilder.Entity<InstanceIdentity>();
        instance.ToTable("instance_identity"); instance.HasKey(value => value.Key);
        instance.Property(value => value.Key).HasColumnName("key").ValueGeneratedNever();
        instance.Property(value => value.InstanceId).HasColumnName("instance_id").IsRequired();
        instance.Property(value => value.CreatedAt).HasColumnName("created_at").IsRequired();
        instance.HasIndex(value => value.InstanceId).IsUnique();

        var peer = modelBuilder.Entity<FederationPeer>();
        peer.ToTable("federation_peers"); peer.HasKey(value => value.InstanceId);
        peer.Property(value => value.InstanceId).HasColumnName("instance_id").ValueGeneratedNever();
        peer.Property(value => value.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
        peer.Property(value => value.BaseUrl).HasColumnName("base_url").HasMaxLength(2048).IsRequired();
        peer.Property(value => value.CreatedAt).HasColumnName("created_at").IsRequired();
        peer.Property(value => value.IsActive).HasColumnName("is_active").IsRequired();
        peer.Property(value => value.PinnedPublicKeySpki).HasColumnName("pinned_public_key_spki").HasMaxLength(512);
        peer.Property(value => value.PendingPinnedPublicKeySpki).HasColumnName("pending_pinned_public_key_spki").HasMaxLength(512);
        peer.Property(value => value.PendingKeyRotationId).HasColumnName("pending_key_rotation_id").IsConcurrencyToken();
        peer.Property(value => value.KeyRotationStagedAt).HasColumnName("key_rotation_staged_at");
        peer.Property(value => value.LastCompletedKeyRotationId).HasColumnName("last_completed_key_rotation_id");
        peer.Property(value => value.LastProofAt).HasColumnName("last_proof_at");
        peer.HasIndex(value => value.PinnedPublicKeySpki).IsUnique();

        var signing = modelBuilder.Entity<FederationSigningIdentity>();
        signing.ToTable("federation_signing_identity"); signing.HasKey(value => value.Key);
        signing.Property(value => value.Key).HasColumnName("key").ValueGeneratedNever();
        signing.Property(value => value.PublicKeySpki).HasColumnName("public_key_spki").HasMaxLength(512).IsRequired();
        signing.Property(value => value.ProtectedPrivateKey).HasColumnName("protected_private_key").HasMaxLength(4096).IsRequired();
        signing.Property(value => value.CreatedAt).HasColumnName("created_at");
        signing.Property(value => value.PendingRotationId).HasColumnName("pending_rotation_id").IsConcurrencyToken();
        signing.Property(value => value.PendingPublicKeySpki).HasColumnName("pending_public_key_spki").HasMaxLength(512);
        signing.Property(value => value.PendingProtectedPrivateKey).HasColumnName("pending_protected_private_key").HasMaxLength(4096);
        signing.Property(value => value.PendingCreatedAt).HasColumnName("pending_created_at");
        signing.Property(value => value.ActiveRotationId).HasColumnName("active_rotation_id").IsConcurrencyToken();
        signing.Property(value => value.RotationActivatedAt).HasColumnName("rotation_activated_at");

        var probeNonce = modelBuilder.Entity<FederationProbeNonce>();
        probeNonce.ToTable("federation_probe_nonces");
        probeNonce.HasKey(value => new { value.PeerInstanceId, value.Nonce });
        probeNonce.Property(value => value.PeerInstanceId).HasColumnName("peer_instance_id").ValueGeneratedNever();
        probeNonce.Property(value => value.Nonce).HasColumnName("nonce").ValueGeneratedNever();
        probeNonce.Property(value => value.ReceivedAt).HasColumnName("received_at");
        probeNonce.HasIndex(value => value.ReceivedAt);
        probeNonce.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.PeerInstanceId).OnDelete(DeleteBehavior.Restrict);

        var publication = modelBuilder.Entity<FederationSitePublication>();
        publication.ToTable("federation_site_publications");
        publication.HasKey(value => new { value.PeerInstanceId, value.LocalSiteId });
        publication.Property(value => value.PeerInstanceId).HasColumnName("peer_instance_id").ValueGeneratedNever();
        publication.Property(value => value.LocalSiteId).HasColumnName("local_site_id").ValueGeneratedNever();
        publication.Property(value => value.IsActive).HasColumnName("is_active");
        publication.Property(value => value.Revision).HasColumnName("revision");
        publication.Property(value => value.CreatedAt).HasColumnName("created_at");
        publication.Property(value => value.UpdatedAt).HasColumnName("updated_at");
        publication.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.PeerInstanceId).OnDelete(DeleteBehavior.Restrict);
        publication.HasOne<Site>().WithMany().HasForeignKey(value => value.LocalSiteId).OnDelete(DeleteBehavior.Restrict);

        var grant = modelBuilder.Entity<FederationSiteGrant>();
        grant.ToTable("federation_site_grants", table => table.HasCheckConstraint(
            "CK_federation_site_grants_direction", "direction IN ('inbound', 'outbound')"));
        grant.HasKey(value => value.Id);
        grant.Property(value => value.Id).HasColumnName("id").ValueGeneratedNever();
        grant.Property(value => value.PeerInstanceId).HasColumnName("peer_instance_id").ValueGeneratedNever();
        grant.Property(value => value.LocalSiteId).HasColumnName("local_site_id").ValueGeneratedNever();
        grant.Property(value => value.RemoteSiteId).HasColumnName("remote_site_id").ValueGeneratedNever();
        grant.Property(value => value.Direction).HasColumnName("direction").HasMaxLength(8).IsRequired();
        grant.Property(value => value.IsActive).HasColumnName("is_active").IsRequired();
        grant.Property(value => value.Revision).HasColumnName("revision").IsRequired();
        grant.Property(value => value.CreatedAt).HasColumnName("created_at").IsRequired();
        grant.Property(value => value.UpdatedAt).HasColumnName("updated_at").IsRequired();
        grant.HasIndex(value => new { value.LocalSiteId, value.IsActive });
        grant.HasIndex(value => new { value.PeerInstanceId, value.LocalSiteId, value.RemoteSiteId, value.Direction }).IsUnique();
        grant.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.PeerInstanceId).OnDelete(DeleteBehavior.Restrict);
        grant.HasOne<Site>().WithMany().HasForeignKey(value => value.LocalSiteId).OnDelete(DeleteBehavior.Restrict);

        var remoteSite = modelBuilder.Entity<FederationRemoteSite>();
        remoteSite.ToTable("federation_remote_sites");
        remoteSite.HasKey(value => new { value.InstanceId, value.SiteId });
        remoteSite.Property(value => value.InstanceId).HasColumnName("instance_id").ValueGeneratedNever();
        remoteSite.Property(value => value.SiteId).HasColumnName("site_id").ValueGeneratedNever();
        remoteSite.Property(value => value.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        remoteSite.Property(value => value.CatalogRevision).HasColumnName("catalog_revision").IsRequired();
        remoteSite.Property(value => value.UpdatedAt).HasColumnName("updated_at").IsRequired();
        remoteSite.Property(value => value.IsActive).HasColumnName("is_active").IsRequired();
        remoteSite.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.InstanceId).OnDelete(DeleteBehavior.Restrict);

        var workLink = modelBuilder.Entity<FederationWorkLink>();
        workLink.ToTable("federation_work_links", table => table.HasCheckConstraint(
            "CK_federation_work_links_direction", "direction IN ('incoming', 'outgoing')"));
        workLink.HasKey(value => value.Id);
        workLink.Property(value => value.Id).HasColumnName("id").ValueGeneratedNever();
        workLink.Property(value => value.LocalWorkItemId).HasColumnName("local_work_item_id");
        workLink.Property(value => value.PeerInstanceId).HasColumnName("peer_instance_id");
        workLink.Property(value => value.RemoteSiteId).HasColumnName("remote_site_id");
        workLink.Property(value => value.OriginInstanceId).HasColumnName("origin_instance_id");
        workLink.Property(value => value.OriginSiteId).HasColumnName("origin_site_id");
        workLink.Property(value => value.OriginResourceId).HasColumnName("origin_resource_id");
        workLink.Property(value => value.Direction).HasColumnName("direction").HasMaxLength(8).IsRequired();
        workLink.Property(value => value.RemoteWorkItemId).HasColumnName("remote_work_item_id");
        workLink.Property(value => value.CreatedAt).HasColumnName("created_at");
        workLink.Property(value => value.AcknowledgedAt).HasColumnName("acknowledged_at");
        workLink.Property(value => value.OfficialAnswerMessageId).HasColumnName("official_answer_message_id");
        workLink.Property(value => value.OfficialAnswer).HasColumnName("official_answer").HasMaxLength(100_000);
        workLink.Property(value => value.OfficialAnswerClassification)
            .HasColumnName("official_answer_classification").HasMaxLength(20);
        workLink.Property(value => value.OfficialAnswerApprovedAt).HasColumnName("official_answer_approved_at");
        workLink.Property(value => value.OfficialAnswerSiteName).HasColumnName("official_answer_site_name").HasMaxLength(200);
        workLink.Property(value => value.RemoteProgressSequence).HasColumnName("remote_progress_sequence").IsConcurrencyToken();
        workLink.Property(value => value.RemoteProgressStatus).HasColumnName("remote_progress_status").HasMaxLength(24);
        workLink.Property(value => value.RemoteProgressAt).HasColumnName("remote_progress_at");
        workLink.HasIndex(value => value.OfficialAnswerMessageId).IsUnique();
        workLink.HasIndex(value => value.LocalWorkItemId).IsUnique();
        workLink.HasIndex(value => new { value.OriginInstanceId, value.OriginSiteId, value.OriginResourceId, value.PeerInstanceId, value.RemoteSiteId })
            .IsUnique().HasDatabaseName("IX_federation_work_links_origin_address");
        workLink.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.PeerInstanceId).OnDelete(DeleteBehavior.Restrict);
        workLink.HasOne<WorkItem>().WithMany().HasForeignKey(value => value.LocalWorkItemId).OnDelete(DeleteBehavior.Restrict);

        var inboundReceipt = modelBuilder.Entity<FederationInboundReceipt>();
        inboundReceipt.ToTable("federation_inbound_receipts");
        inboundReceipt.HasKey(value => new { value.PeerInstanceId, value.MessageId });
        inboundReceipt.Property(value => value.PeerInstanceId).HasColumnName("peer_instance_id").ValueGeneratedNever();
        inboundReceipt.Property(value => value.MessageId).HasColumnName("message_id").ValueGeneratedNever();
        inboundReceipt.Property(value => value.MessageType).HasColumnName("message_type").HasMaxLength(80).IsRequired();
        inboundReceipt.Property(value => value.SourceSiteId).HasColumnName("source_site_id");
        inboundReceipt.Property(value => value.DestinationSiteId).HasColumnName("destination_site_id");
        inboundReceipt.Property(value => value.OriginInstanceId).HasColumnName("origin_instance_id");
        inboundReceipt.Property(value => value.OriginSiteId).HasColumnName("origin_site_id");
        inboundReceipt.Property(value => value.OriginResourceId).HasColumnName("origin_resource_id");
        inboundReceipt.Property(value => value.CorrelationId).HasColumnName("correlation_id");
        inboundReceipt.Property(value => value.CausationId).HasColumnName("causation_id");
        inboundReceipt.Property(value => value.PayloadSha256).HasColumnName("payload_sha256").HasMaxLength(64).IsRequired();
        inboundReceipt.Property(value => value.LocalWorkItemId).HasColumnName("local_work_item_id");
        inboundReceipt.Property(value => value.ReceivedAt).HasColumnName("received_at");
        inboundReceipt.HasIndex(value => value.LocalWorkItemId);
        inboundReceipt.HasIndex(value => value.ReceivedAt);
        inboundReceipt.HasIndex(value => new { value.DestinationSiteId, value.ReceivedAt });
        inboundReceipt.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.PeerInstanceId).OnDelete(DeleteBehavior.Restrict);
        inboundReceipt.HasOne<WorkItem>().WithMany().HasForeignKey(value => value.LocalWorkItemId).OnDelete(DeleteBehavior.Restrict);

        var outbound = modelBuilder.Entity<FederationOutboundMessage>();
        outbound.ToTable("federation_outbound_messages", table => table.HasCheckConstraint(
            "CK_federation_outbound_messages_status", "status IN ('pending', 'retrying', 'delivered', 'failed')"));
        outbound.HasKey(value => value.MessageId);
        outbound.Property(value => value.MessageId).HasColumnName("message_id").ValueGeneratedNever();
        outbound.Property(value => value.PeerInstanceId).HasColumnName("peer_instance_id");
        outbound.Property(value => value.SourceSiteId).HasColumnName("source_site_id");
        outbound.Property(value => value.DestinationSiteId).HasColumnName("destination_site_id");
        outbound.Property(value => value.OriginInstanceId).HasColumnName("origin_instance_id");
        outbound.Property(value => value.OriginSiteId).HasColumnName("origin_site_id");
        outbound.Property(value => value.OriginResourceId).HasColumnName("origin_resource_id");
        outbound.Property(value => value.MessageType).HasColumnName("message_type").HasMaxLength(80).IsRequired();
        outbound.Property(value => value.SchemaVersion).HasColumnName("schema_version");
        outbound.Property(value => value.PayloadJson).HasColumnName("payload_json").HasMaxLength(1_000_000).IsRequired();
        outbound.Property(value => value.CorrelationId).HasColumnName("correlation_id");
        outbound.Property(value => value.CausationId).HasColumnName("causation_id");
        outbound.Property(value => value.Status).HasColumnName("status").HasMaxLength(12).IsRequired();
        outbound.Property(value => value.AttemptCount).HasColumnName("attempt_count");
        outbound.Property(value => value.CreatedAt).HasColumnName("created_at");
        outbound.Property(value => value.NextAttemptAt).HasColumnName("next_attempt_at");
        outbound.Property(value => value.DeliveredAt).HasColumnName("delivered_at");
        outbound.Property(value => value.LastErrorCode).HasColumnName("last_error_code").HasMaxLength(80);
        outbound.HasIndex(value => new { value.Status, value.NextAttemptAt });
        outbound.HasIndex(value => new { value.Status, value.DeliveredAt });
        outbound.HasIndex(value => new { value.PeerInstanceId, value.Status });
        outbound.HasIndex(value => new { value.PeerInstanceId, value.CreatedAt });
        outbound.HasOne<FederationPeer>().WithMany().HasForeignKey(value => value.PeerInstanceId).OnDelete(DeleteBehavior.Restrict);
        outbound.HasOne<Site>().WithMany().HasForeignKey(value => value.SourceSiteId).OnDelete(DeleteBehavior.Restrict);

        var federationRouting = modelBuilder.Entity<FederationRoutingSettings>();
        federationRouting.ToTable("federation_routing_settings");
        federationRouting.HasKey(value => value.Key);
        federationRouting.Property(value => value.Key).HasColumnName("key").ValueGeneratedNever();
        federationRouting.Property(value => value.Enabled).HasColumnName("enabled").IsConcurrencyToken();
        federationRouting.Property(value => value.ChangedBy).HasColumnName("changed_by");
        federationRouting.Property(value => value.ChangedAt).HasColumnName("changed_at");

        var license = modelBuilder.Entity<InstalledLicense>();
        license.ToTable("installed_license"); license.HasKey(value => value.Key);
        license.Property(value => value.Key).HasColumnName("key").ValueGeneratedNever();
        license.Property(value => value.Payload).HasColumnName("payload").HasMaxLength(24_000).IsRequired();
        license.Property(value => value.Signature).HasColumnName("signature").HasMaxLength(256).IsRequired();
        license.Property(value => value.ImportedBy).HasColumnName("imported_by").IsRequired();
        license.Property(value => value.ImportedAt).HasColumnName("imported_at").IsRequired();

        var branding = modelBuilder.Entity<BrandingSettings>();
        branding.ToTable("branding_settings"); branding.HasKey(value => value.Id);
        branding.Property(value => value.Id).HasColumnName("id");
        branding.Property(value => value.ProductName).HasColumnName("product_name").HasMaxLength(80).IsRequired();
        branding.Property(value => value.InstanceName).HasColumnName("instance_name").HasMaxLength(80).IsRequired();
        branding.Property(value => value.Theme).HasColumnName("theme").HasMaxLength(20).IsRequired();
        branding.Property(value => value.PrimaryColor).HasColumnName("primary_color").HasMaxLength(7).IsRequired();
        branding.Property(value => value.AccentColor).HasColumnName("accent_color").HasMaxLength(7).IsRequired();
        branding.Property(value => value.TopBarColor).HasColumnName("top_bar_color").HasMaxLength(7).IsRequired();
        branding.Property(value => value.TopBarTextColor).HasColumnName("top_bar_text_color").HasMaxLength(7).IsRequired();
        branding.Property(value => value.CustomCss).HasColumnName("custom_css").HasMaxLength(20_000).IsRequired();
        branding.Property(value => value.Logo).HasColumnName("logo"); branding.Property(value => value.LogoContentType).HasColumnName("logo_content_type").HasMaxLength(50);

        var smtp = modelBuilder.Entity<SmtpSettings>();
        smtp.ToTable("smtp_settings"); smtp.HasKey(value => value.Id);
        smtp.Property(value => value.Id).HasColumnName("id");
        smtp.Property(value => value.Enabled).HasColumnName("enabled");
        smtp.Property(value => value.Host).HasColumnName("host").HasMaxLength(255).IsRequired();
        smtp.Property(value => value.Port).HasColumnName("port");
        smtp.Property(value => value.Security).HasColumnName("security").HasMaxLength(20).IsRequired();
        smtp.Property(value => value.Username).HasColumnName("username").HasMaxLength(255);
        smtp.Property(value => value.ProtectedPassword).HasColumnName("protected_password");
        smtp.Property(value => value.FromAddress).HasColumnName("from_address").HasMaxLength(320).IsRequired();
        smtp.Property(value => value.FromName).HasColumnName("from_name").HasMaxLength(200).IsRequired();
        smtp.Property(value => value.LastTestedAt).HasColumnName("last_tested_at");
        smtp.Property(value => value.LastTestSucceeded).HasColumnName("last_test_succeeded");
        smtp.Property(value => value.LastTestError).HasColumnName("last_test_error").HasMaxLength(300);
    }
}
