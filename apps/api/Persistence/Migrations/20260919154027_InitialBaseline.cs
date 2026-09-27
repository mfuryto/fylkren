using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "api_machine_identities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    key_id = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    salt = table.Column<byte[]>(type: "bytea", nullable: false),
                    secret_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    scopes = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_machine_identities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "audit_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    actor_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "branding_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    instance_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    theme = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    primary_color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    accent_color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    top_bar_color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    top_bar_text_color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    logo = table.Column<byte[]>(type: "bytea", nullable: true),
                    logo_content_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branding_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notification_outbox",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    audit_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    recipient_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    body = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    from_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_outbox", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notification_projection_cursors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    last_occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_audit_event_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_projection_cursors", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notification_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    body = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_templates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "people",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    normalized_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    profile_image = table.Column<byte[]>(type: "bytea", nullable: true),
                    profile_image_content_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_people", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "personal_notification_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    new_work_items = table.Column<bool>(type: "boolean", nullable: false),
                    work_item_changes = table.Column<bool>(type: "boolean", nullable: false),
                    decisions_required = table.Column<bool>(type: "boolean", nullable: false),
                    child_work_completed = table.Column<bool>(type: "boolean", nullable: false),
                    planning_completed = table.Column<bool>(type: "boolean", nullable: false),
                    execution_completed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_personal_notification_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "smtp_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    host = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    port = table.Column<int>(type: "integer", nullable: false),
                    security = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    username = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    protected_password = table.Column<string>(type: "text", nullable: true),
                    from_address = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    from_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    last_tested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_test_succeeded = table.Column<bool>(type: "boolean", nullable: true),
                    last_test_error = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_smtp_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "api_idempotency_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    machine_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    resource_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_idempotency_records", x => x.id);
                    table.ForeignKey(
                        name: "FK_api_idempotency_records_api_machine_identities_machine_iden~",
                        column: x => x.machine_identity_id,
                        principalTable: "api_machine_identities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "api_report_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    machine_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    include_classified = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_report_grants", x => x.id);
                    table.ForeignKey(
                        name: "FK_api_report_grants_api_machine_identities_machine_identity_id",
                        column: x => x.machine_identity_id,
                        principalTable: "api_machine_identities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "external_identity_links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    subject_id = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    username = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_external_identity_links", x => x.id);
                    table.ForeignKey(
                        name: "FK_external_identity_links_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "login_identities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    normalized_username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    is_platform_manager = table.Column<bool>(type: "boolean", nullable: false),
                    must_change_password = table.Column<bool>(type: "boolean", nullable: false),
                    totp_secret = table.Column<string>(type: "text", nullable: true),
                    recovery_code_hashes = table.Column<string>(type: "text", nullable: true),
                    totp_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_signed_in_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_login_identities", x => x.id);
                    table.ForeignKey(
                        name: "FK_login_identities_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "webauthn_credentials",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    credential_id = table.Column<byte[]>(type: "bytea", nullable: false),
                    public_key = table.Column<byte[]>(type: "bytea", nullable: false),
                    user_handle = table.Column<byte[]>(type: "bytea", nullable: false),
                    sign_count = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_webauthn_credentials", x => x.id);
                    table.ForeignKey(
                        name: "FK_webauthn_credentials_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "api_machine_audit_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    machine_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    event_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    correlation_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_machine_audit_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_api_machine_audit_events_api_machine_identities_machine_ide~",
                        column: x => x.machine_identity_id,
                        principalTable: "api_machine_identities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "execution_external_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    request_text = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    response_text = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_external_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "execution_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    definition_id = table.Column<Guid>(type: "uuid", nullable: true),
                    claimed_by_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    current_step = table.Column<int>(type: "integer", nullable: false),
                    timeline_started_on = table.Column<DateOnly>(type: "date", nullable: true),
                    claimed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_runs", x => x.id);
                    table.ForeignKey(
                        name: "FK_execution_runs_people_claimed_by_person_id",
                        column: x => x.claimed_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "execution_step_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_step_documents", x => x.id);
                    table.ForeignKey(
                        name: "FK_execution_step_documents_execution_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "execution_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "execution_timeline_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_execution_timeline_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_execution_timeline_events_execution_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "execution_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "organization_roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_leader = table.Column<bool>(type: "boolean", nullable: false),
                    has_leader_access = table.Column<bool>(type: "boolean", nullable: false),
                    can_plan = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organization_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "role_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    valid_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    valid_to = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    can_lead_parent_level = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_role_assignments_organization_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "organization_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_role_assignments_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "organization_unit_memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organization_unit_memberships", x => x.id);
                    table.ForeignKey(
                        name: "FK_organization_unit_memberships_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "organization_units",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_temporary = table.Column<bool>(type: "boolean", nullable: false),
                    is_site_root = table.Column<bool>(type: "boolean", nullable: false),
                    works_at_parent_level = table.Column<bool>(type: "boolean", nullable: false),
                    is_site_leadership = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organization_units", x => x.id);
                    table.ForeignKey(
                        name: "FK_organization_units_organization_units_parent_id",
                        column: x => x.parent_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    final_report_template = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    overview_design = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sites", x => x.id);
                    table.ForeignKey(
                        name: "FK_sites_organization_units_parent_organization_unit_id",
                        column: x => x.parent_organization_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "site_manager_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site_manager_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_site_manager_assignments_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_site_manager_assignments_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "site_memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site_memberships", x => x.id);
                    table.ForeignKey(
                        name: "FK_site_memberships_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_site_memberships_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "site_notification_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    new_work_items = table.Column<bool>(type: "boolean", nullable: false),
                    work_item_changes = table.Column<bool>(type: "boolean", nullable: false),
                    decisions_required = table.Column<bool>(type: "boolean", nullable: false),
                    child_work_completed = table.Column<bool>(type: "boolean", nullable: false),
                    planning_completed = table.Column<bool>(type: "boolean", nullable: false),
                    execution_completed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site_notification_settings", x => x.id);
                    table.ForeignKey(
                        name: "FK_site_notification_settings_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "work_item_lookups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_item_lookups", x => x.id);
                    table.ForeignKey(
                        name: "FK_work_item_lookups_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "work_item_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_system_managed = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_item_types", x => x.id);
                    table.ForeignKey(
                        name: "FK_work_item_types_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    owner_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_definitions", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_definitions_organization_units_owner_unit_id",
                        column: x => x.owner_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_definitions_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_step_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    content = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_step_templates", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_step_templates_organization_units_owner_unit_id",
                        column: x => x.owner_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_step_templates_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "work_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_work_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    work_item_type_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_type_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sender_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sender_site_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    sender_person_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    source_type_name_snapshot = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    work_item_type_name_snapshot = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    sender_name_snapshot = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    upstream_plan_work_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    request_basis_snapshot = table.Column<string>(type: "character varying(100000)", maxLength: 100000, nullable: true),
                    assigned_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    recommendation = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    reference_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    decision_note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    final_report = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    final_report_classification = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    final_report_created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    final_report_updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    final_report_written_by_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    final_report_approved_by_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    final_report_approved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_work_items_organization_units_assigned_unit_id",
                        column: x => x.assigned_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_people_created_by_person_id",
                        column: x => x.created_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_people_final_report_approved_by_person_id",
                        column: x => x.final_report_approved_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_people_final_report_written_by_person_id",
                        column: x => x.final_report_written_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_work_item_lookups_sender_id",
                        column: x => x.sender_id,
                        principalTable: "work_item_lookups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_work_item_lookups_source_type_id",
                        column: x => x.source_type_id,
                        principalTable: "work_item_lookups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_work_item_types_work_item_type_id",
                        column: x => x.work_item_type_id,
                        principalTable: "work_item_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_items_work_items_parent_work_item_id",
                        column: x => x.parent_work_item_id,
                        principalTable: "work_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_steps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    template_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_optional = table.Column<bool>(type: "boolean", nullable: false),
                    allows_task_allocation = table.Column<bool>(type: "boolean", nullable: false),
                    has_timeline = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_steps", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_steps_workflow_definitions_definition_id",
                        column: x => x.definition_id,
                        principalTable: "workflow_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_steps_workflow_step_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "workflow_step_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "work_item_state_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_item_state_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_work_item_state_history_organization_units_assigned_unit_id",
                        column: x => x.assigned_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_item_state_history_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_item_state_history_work_items_work_item_id",
                        column: x => x.work_item_id,
                        principalTable: "work_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    claimed_by_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    current_step = table.Column<int>(type: "integer", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    timeline_started_on = table.Column<DateOnly>(type: "date", nullable: true),
                    proposed_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    proposed_priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    proposed_due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    result_note = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_runs", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_runs_organization_units_proposed_unit_id",
                        column: x => x.proposed_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_runs_people_claimed_by_person_id",
                        column: x => x.claimed_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_runs_work_items_work_item_id",
                        column: x => x.work_item_id,
                        principalTable: "work_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_runs_workflow_definitions_definition_id",
                        column: x => x.definition_id,
                        principalTable: "workflow_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_plan_allocations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    unit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    instruction = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_plan_allocations", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_plan_allocations_organization_units_unit_id",
                        column: x => x.unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_plan_allocations_workflow_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_plan_allocations_workflow_steps_step_id",
                        column: x => x.step_id,
                        principalTable: "workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_plan_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    instruction = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_plan_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_plan_requests_sites_target_site_id",
                        column: x => x.target_site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workflow_plan_requests_workflow_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_plan_requests_workflow_steps_step_id",
                        column: x => x.step_id,
                        principalTable: "workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_step_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_step_documents", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_step_documents_workflow_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_step_documents_workflow_steps_step_id",
                        column: x => x.step_id,
                        principalTable: "workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_step_links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_step_links", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_step_links_workflow_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_step_links_workflow_steps_step_id",
                        column: x => x.step_id,
                        principalTable: "workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "workflow_timeline_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_timeline_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_workflow_timeline_events_workflow_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_timeline_events_workflow_steps_step_id",
                        column: x => x.step_id,
                        principalTable: "workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_api_idempotency_records_machine_identity_id_key",
                table: "api_idempotency_records",
                columns: new[] { "machine_identity_id", "key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_api_machine_audit_events_machine_identity_id",
                table: "api_machine_audit_events",
                column: "machine_identity_id");

            migrationBuilder.CreateIndex(
                name: "IX_api_machine_audit_events_occurred_at",
                table: "api_machine_audit_events",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "IX_api_machine_audit_events_site_id",
                table: "api_machine_audit_events",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "IX_api_machine_identities_key_id",
                table: "api_machine_identities",
                column: "key_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_api_report_grants_machine_identity_id_site_id_organization_~",
                table: "api_report_grants",
                columns: new[] { "machine_identity_id", "site_id", "organization_unit_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_audit_events_site_id_occurred_at",
                table: "audit_events",
                columns: new[] { "site_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_execution_external_requests_run_id_step_id",
                table: "execution_external_requests",
                columns: new[] { "run_id", "step_id" });

            migrationBuilder.CreateIndex(
                name: "IX_execution_external_requests_step_id",
                table: "execution_external_requests",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_execution_runs_claimed_by_person_id",
                table: "execution_runs",
                column: "claimed_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_execution_runs_definition_id",
                table: "execution_runs",
                column: "definition_id");

            migrationBuilder.CreateIndex(
                name: "IX_execution_runs_work_item_id",
                table: "execution_runs",
                column: "work_item_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_execution_step_documents_run_id_step_id",
                table: "execution_step_documents",
                columns: new[] { "run_id", "step_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_execution_step_documents_step_id",
                table: "execution_step_documents",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_execution_timeline_events_run_id_step_id_sort_order",
                table: "execution_timeline_events",
                columns: new[] { "run_id", "step_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_execution_timeline_events_step_id",
                table: "execution_timeline_events",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_external_identity_links_person_id",
                table: "external_identity_links",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_external_identity_links_provider_subject_id",
                table: "external_identity_links",
                columns: new[] { "provider", "subject_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_login_identities_normalized_username",
                table: "login_identities",
                column: "normalized_username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_login_identities_person_id",
                table: "login_identities",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_notification_outbox_audit_event_id_recipient_person_id",
                table: "notification_outbox",
                columns: new[] { "audit_event_id", "recipient_person_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notification_outbox_status_next_attempt_at",
                table: "notification_outbox",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_templates_key",
                table: "notification_templates",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_organization_roles_organization_unit_id",
                table: "organization_roles",
                column: "organization_unit_id",
                unique: true,
                filter: "is_leader");

            migrationBuilder.CreateIndex(
                name: "IX_organization_roles_organization_unit_id_normalized_name",
                table: "organization_roles",
                columns: new[] { "organization_unit_id", "normalized_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_organization_unit_memberships_organization_unit_id",
                table: "organization_unit_memberships",
                column: "organization_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_organization_unit_memberships_person_id",
                table: "organization_unit_memberships",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_organization_unit_memberships_site_id_person_id",
                table: "organization_unit_memberships",
                columns: new[] { "site_id", "person_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_organization_units_one_site_leadership",
                table: "organization_units",
                column: "site_id",
                unique: true,
                filter: "is_site_leadership");

            migrationBuilder.CreateIndex(
                name: "IX_organization_units_parent_id",
                table: "organization_units",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "IX_organization_units_site_id_is_site_root",
                table: "organization_units",
                columns: new[] { "site_id", "is_site_root" },
                unique: true,
                filter: "is_site_root");

            migrationBuilder.CreateIndex(
                name: "IX_organization_units_site_id_normalized_name",
                table: "organization_units",
                columns: new[] { "site_id", "normalized_name" },
                unique: true,
                filter: "parent_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_organization_units_site_id_parent_id_normalized_name",
                table: "organization_units",
                columns: new[] { "site_id", "parent_id", "normalized_name" },
                unique: true,
                filter: "parent_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_people_normalized_email",
                table: "people",
                column: "normalized_email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_personal_notification_settings_site_id_person_id",
                table: "personal_notification_settings",
                columns: new[] { "site_id", "person_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_role_assignments_person_id",
                table: "role_assignments",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_role_assignments_role_id_person_id_valid_from",
                table: "role_assignments",
                columns: new[] { "role_id", "person_id", "valid_from" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_site_manager_assignments_person_id",
                table: "site_manager_assignments",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_site_manager_assignments_site_id_person_id",
                table: "site_manager_assignments",
                columns: new[] { "site_id", "person_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_site_memberships_person_id",
                table: "site_memberships",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_site_memberships_site_id_person_id",
                table: "site_memberships",
                columns: new[] { "site_id", "person_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_site_notification_settings_site_id",
                table: "site_notification_settings",
                column: "site_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sites_normalized_name",
                table: "sites",
                column: "normalized_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sites_parent_organization_unit_id",
                table: "sites",
                column: "parent_organization_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_webauthn_credentials_credential_id",
                table: "webauthn_credentials",
                column: "credential_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_webauthn_credentials_person_id",
                table: "webauthn_credentials",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_item_lookups_site_id_kind_normalized_name",
                table: "work_item_lookups",
                columns: new[] { "site_id", "kind", "normalized_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_item_state_history_assigned_unit_id",
                table: "work_item_state_history",
                column: "assigned_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_item_state_history_site_id_occurred_at",
                table: "work_item_state_history",
                columns: new[] { "site_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_work_item_state_history_work_item_id_occurred_at",
                table: "work_item_state_history",
                columns: new[] { "work_item_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_work_item_types_site_id_normalized_name",
                table: "work_item_types",
                columns: new[] { "site_id", "normalized_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_items_assigned_unit_id",
                table: "work_items",
                column: "assigned_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_created_by_person_id",
                table: "work_items",
                column: "created_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_final_report_approved_by_person_id",
                table: "work_items",
                column: "final_report_approved_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_final_report_written_by_person_id",
                table: "work_items",
                column: "final_report_written_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_parent_work_item_id",
                table: "work_items",
                column: "parent_work_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_sender_id",
                table: "work_items",
                column: "sender_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_site_id_assigned_unit_id_status_final_report_app~",
                table: "work_items",
                columns: new[] { "site_id", "assigned_unit_id", "status", "final_report_approved_at" });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_site_id_status_due_at",
                table: "work_items",
                columns: new[] { "site_id", "status", "due_at" });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_source_type_id",
                table: "work_items",
                column: "source_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_work_items_work_item_type_id",
                table: "work_items",
                column: "work_item_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_owner_unit_id",
                table: "workflow_definitions",
                column: "owner_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_site_id",
                table: "workflow_definitions",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_plan_allocations_run_id_step_id_unit_id",
                table: "workflow_plan_allocations",
                columns: new[] { "run_id", "step_id", "unit_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_workflow_plan_allocations_step_id",
                table: "workflow_plan_allocations",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_plan_allocations_unit_id",
                table: "workflow_plan_allocations",
                column: "unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_plan_requests_run_id_step_id_target_site_id",
                table: "workflow_plan_requests",
                columns: new[] { "run_id", "step_id", "target_site_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_workflow_plan_requests_step_id",
                table: "workflow_plan_requests",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_plan_requests_target_site_id",
                table: "workflow_plan_requests",
                column: "target_site_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_runs_claimed_by_person_id",
                table: "workflow_runs",
                column: "claimed_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_runs_definition_id",
                table: "workflow_runs",
                column: "definition_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_runs_proposed_unit_id",
                table: "workflow_runs",
                column: "proposed_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_runs_work_item_id",
                table: "workflow_runs",
                column: "work_item_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_workflow_step_documents_run_id_step_id",
                table: "workflow_step_documents",
                columns: new[] { "run_id", "step_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_workflow_step_documents_step_id",
                table: "workflow_step_documents",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_step_links_run_id_step_id",
                table: "workflow_step_links",
                columns: new[] { "run_id", "step_id" });

            migrationBuilder.CreateIndex(
                name: "IX_workflow_step_links_step_id",
                table: "workflow_step_links",
                column: "step_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_step_templates_owner_unit_id",
                table: "workflow_step_templates",
                column: "owner_unit_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_step_templates_site_name",
                table: "workflow_step_templates",
                columns: new[] { "site_id", "name" },
                unique: true,
                filter: "is_active AND owner_unit_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_step_templates_site_owner_name",
                table: "workflow_step_templates",
                columns: new[] { "site_id", "owner_unit_id", "name" },
                unique: true,
                filter: "is_active AND owner_unit_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_steps_definition_id_sort_order",
                table: "workflow_steps",
                columns: new[] { "definition_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_workflow_steps_template_id",
                table: "workflow_steps",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_timeline_events_run_id_step_id_sort_order",
                table: "workflow_timeline_events",
                columns: new[] { "run_id", "step_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_workflow_timeline_events_step_id",
                table: "workflow_timeline_events",
                column: "step_id");

            migrationBuilder.AddForeignKey(
                name: "FK_api_machine_audit_events_sites_site_id",
                table: "api_machine_audit_events",
                column: "site_id",
                principalTable: "sites",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_execution_external_requests_execution_runs_run_id",
                table: "execution_external_requests",
                column: "run_id",
                principalTable: "execution_runs",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_execution_external_requests_workflow_steps_step_id",
                table: "execution_external_requests",
                column: "step_id",
                principalTable: "workflow_steps",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_execution_runs_work_items_work_item_id",
                table: "execution_runs",
                column: "work_item_id",
                principalTable: "work_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_execution_runs_workflow_definitions_definition_id",
                table: "execution_runs",
                column: "definition_id",
                principalTable: "workflow_definitions",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_execution_step_documents_workflow_steps_step_id",
                table: "execution_step_documents",
                column: "step_id",
                principalTable: "workflow_steps",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_execution_timeline_events_workflow_steps_step_id",
                table: "execution_timeline_events",
                column: "step_id",
                principalTable: "workflow_steps",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_organization_roles_organization_units_organization_unit_id",
                table: "organization_roles",
                column: "organization_unit_id",
                principalTable: "organization_units",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_organization_unit_memberships_organization_units_organizati~",
                table: "organization_unit_memberships",
                column: "organization_unit_id",
                principalTable: "organization_units",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_organization_unit_memberships_sites_site_id",
                table: "organization_unit_memberships",
                column: "site_id",
                principalTable: "sites",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_organization_units_sites_site_id",
                table: "organization_units",
                column: "site_id",
                principalTable: "sites",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql("""
                CREATE FUNCTION capture_work_item_state() RETURNS trigger AS $$
                BEGIN
                    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
                       OR OLD.assigned_unit_id IS DISTINCT FROM NEW.assigned_unit_id
                       OR OLD.site_id IS DISTINCT FROM NEW.site_id THEN
                        INSERT INTO work_item_state_history
                            (id, work_item_id, site_id, assigned_unit_id, status, occurred_at)
                        VALUES
                            (gen_random_uuid(), NEW.id, NEW.site_id, NEW.assigned_unit_id, NEW.status, NOW());
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER trg_work_item_state_history
                AFTER INSERT OR UPDATE ON work_items
                FOR EACH ROW EXECUTE FUNCTION capture_work_item_state();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_work_item_state_history ON work_items;
                DROP FUNCTION IF EXISTS capture_work_item_state();
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_organization_units_sites_site_id",
                table: "organization_units");

            migrationBuilder.DropTable(
                name: "api_idempotency_records");

            migrationBuilder.DropTable(
                name: "api_machine_audit_events");

            migrationBuilder.DropTable(
                name: "api_report_grants");

            migrationBuilder.DropTable(
                name: "audit_events");

            migrationBuilder.DropTable(
                name: "branding_settings");

            migrationBuilder.DropTable(
                name: "execution_external_requests");

            migrationBuilder.DropTable(
                name: "execution_step_documents");

            migrationBuilder.DropTable(
                name: "execution_timeline_events");

            migrationBuilder.DropTable(
                name: "external_identity_links");

            migrationBuilder.DropTable(
                name: "login_identities");

            migrationBuilder.DropTable(
                name: "notification_outbox");

            migrationBuilder.DropTable(
                name: "notification_projection_cursors");

            migrationBuilder.DropTable(
                name: "notification_templates");

            migrationBuilder.DropTable(
                name: "organization_unit_memberships");

            migrationBuilder.DropTable(
                name: "personal_notification_settings");

            migrationBuilder.DropTable(
                name: "role_assignments");

            migrationBuilder.DropTable(
                name: "site_manager_assignments");

            migrationBuilder.DropTable(
                name: "site_memberships");

            migrationBuilder.DropTable(
                name: "site_notification_settings");

            migrationBuilder.DropTable(
                name: "smtp_settings");

            migrationBuilder.DropTable(
                name: "webauthn_credentials");

            migrationBuilder.DropTable(
                name: "work_item_state_history");

            migrationBuilder.DropTable(
                name: "workflow_plan_allocations");

            migrationBuilder.DropTable(
                name: "workflow_plan_requests");

            migrationBuilder.DropTable(
                name: "workflow_step_documents");

            migrationBuilder.DropTable(
                name: "workflow_step_links");

            migrationBuilder.DropTable(
                name: "workflow_timeline_events");

            migrationBuilder.DropTable(
                name: "api_machine_identities");

            migrationBuilder.DropTable(
                name: "execution_runs");

            migrationBuilder.DropTable(
                name: "organization_roles");

            migrationBuilder.DropTable(
                name: "workflow_runs");

            migrationBuilder.DropTable(
                name: "workflow_steps");

            migrationBuilder.DropTable(
                name: "work_items");

            migrationBuilder.DropTable(
                name: "workflow_definitions");

            migrationBuilder.DropTable(
                name: "workflow_step_templates");

            migrationBuilder.DropTable(
                name: "people");

            migrationBuilder.DropTable(
                name: "work_item_lookups");

            migrationBuilder.DropTable(
                name: "work_item_types");

            migrationBuilder.DropTable(
                name: "sites");

            migrationBuilder.DropTable(
                name: "organization_units");
        }
    }
}
