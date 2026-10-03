using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261003193000_LifecycleGovernanceGuards")]
public sealed class LifecycleGovernanceGuards : Migration
{
    // Delivery, immutable audit/activity, global people and governance are deliberately
    // separate owners. They must not become tenant-owned cascade children.
    private static readonly string[] Tables = ["sites", "organization_units", "site_memberships", "site_manager_assignments", "organization_unit_memberships", "organization_roles", "role_assignments",
        "work_items", "work_item_types", "work_item_lookups", "site_reference_settings", "site_notification_settings", "personal_notification_settings", "workflow_definitions", "workflow_steps", "workflow_step_templates",
        "workflow_runs", "execution_runs", "workflow_plan_allocations", "workflow_plan_requests", "planning_rfi_entries", "workflow_step_documents", "workflow_step_links", "workflow_timeline_events",
        "execution_step_documents", "execution_external_requests", "execution_timeline_events", "work_item_dependencies", "work_item_comments", "work_item_state_history", "learning_lessons", "learning_entries",
        "risks", "risk_revisions", "risk_mitigations", "risk_mitigation_revisions", "decisions", "decision_references", "decision_revisions", "decision_makers", "domain_object_versions", "formal_approval_signoffs"];
    protected override void Up(MigrationBuilder m)
    {
        m.Sql("""
CREATE FUNCTION fylkren_site_context(kind text, row_data jsonb) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE result uuid[] := '{}'; owned uuid; root uuid;
BEGIN
 IF row_data IS NULL THEN RETURN result; END IF;
 IF kind = 'sites' THEN result := ARRAY[(row_data->>'id')::uuid];
 ELSIF row_data ? 'site_id' THEN result := ARRAY[(row_data->>'site_id')::uuid];
 ELSIF row_data ? 'organization_unit_id' THEN
   SELECT site_id INTO owned FROM organization_units WHERE id = (row_data->>'organization_unit_id')::uuid; result := ARRAY[owned];
 ELSIF kind = 'role_assignments' THEN
   SELECT u.site_id INTO owned FROM organization_roles r JOIN organization_units u ON u.id = r.organization_unit_id WHERE r.id = (row_data->>'role_id')::uuid; result := ARRAY[owned];
 ELSIF kind = 'workflow_steps' THEN
   SELECT site_id INTO owned FROM workflow_definitions WHERE id = (row_data->>'definition_id')::uuid; result := ARRAY[owned];
 ELSIF kind IN ('decision_revisions','decision_makers','decision_references') THEN
   SELECT d.site_id INTO owned FROM decisions d WHERE d.id = COALESCE((row_data->>'decision_id')::uuid, (SELECT decision_id FROM decision_revisions WHERE id = (row_data->>'revision_id')::uuid)); result := ARRAY[owned];
 END IF;
 FOR root IN SELECT unnest(fylkren_work_context(kind, row_data)) LOOP
   SELECT site_id INTO owned FROM work_items WHERE id = root; result := result || owned;
 END LOOP;
 RETURN array_remove(result, NULL);
END $$;
CREATE FUNCTION guard_site_archive() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owned uuid; roots uuid[];
BEGIN
 roots := fylkren_site_context(TG_TABLE_NAME, CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END)
       || fylkren_site_context(TG_TABLE_NAME, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
 FOR owned IN SELECT DISTINCT unnest(roots) ORDER BY 1 LOOP
   PERFORM id FROM sites WHERE id = owned FOR SHARE;
   IF EXISTS (SELECT 1 FROM information_lifecycle WHERE owner_site_id = owned AND resource_type = 'site' AND resource_id = owned AND stage <> 'active') THEN
     RAISE EXCEPTION 'Site information is closed or archived.' USING ERRCODE = '23514', CONSTRAINT = 'site_lifecycle_guard';
   END IF;
 END LOOP;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE FUNCTION guard_archived_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM information_lifecycle WHERE owner_site_id IS NULL AND resource_type = 'person' AND resource_id = OLD.id AND stage <> 'active') THEN
   RAISE EXCEPTION 'Person information is closed or archived.' USING ERRCODE = '23514', CONSTRAINT = 'person_lifecycle_guard';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER archived_person_guard BEFORE UPDATE OR DELETE ON people FOR EACH ROW EXECUTE FUNCTION guard_archived_person();
CREATE FUNCTION guard_policy_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Policy versions are immutable.' USING ERRCODE = '23514', CONSTRAINT = 'retention_policy_immutable';
END $$;
CREATE TRIGGER retention_policy_guard BEFORE UPDATE OR DELETE ON retention_policy_versions FOR EACH ROW EXECUTE FUNCTION guard_policy_version();
CREATE FUNCTION guard_work_lifecycle_in_archived_site() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.resource_type = 'work_item' AND (TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM OLD.stage) THEN
   PERFORM id FROM sites WHERE id = NEW.owner_site_id FOR SHARE;
   IF EXISTS (SELECT 1 FROM information_lifecycle WHERE owner_site_id = NEW.owner_site_id AND resource_type = 'site' AND resource_id = NEW.owner_site_id AND stage <> 'active') THEN
     RAISE EXCEPTION 'Site information is closed or archived.' USING ERRCODE = '23514', CONSTRAINT = 'site_lifecycle_guard';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER site_work_lifecycle_guard BEFORE INSERT OR UPDATE ON information_lifecycle FOR EACH ROW EXECUTE FUNCTION guard_work_lifecycle_in_archived_site();
""");
        foreach (var table in Tables) m.Sql($"CREATE TRIGGER archive_site_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION guard_site_archive();");
    }
    protected override void Down(MigrationBuilder m)
    {
        m.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM domain_events WHERE source <> 'legacy' AND context_work_item_id IS NOT NULL) OR EXISTS (SELECT 1 FROM archive_grants) OR EXISTS (SELECT 1 FROM lifecycle_holds) OR EXISTS (SELECT 1 FROM retention_policy_versions) THEN RAISE EXCEPTION 'Governance cutover requires a forward fix.' USING ERRCODE = '23514', CONSTRAINT = 'activity_cutover_forward_fix_required'; END IF; END $$;");
        foreach (var table in Tables) m.Sql($"DROP TRIGGER archive_site_guard ON {table};");
        m.Sql("DROP TRIGGER site_work_lifecycle_guard ON information_lifecycle; DROP TRIGGER retention_policy_guard ON retention_policy_versions; DROP TRIGGER archived_person_guard ON people; DROP FUNCTION guard_work_lifecycle_in_archived_site(); DROP FUNCTION guard_policy_version(); DROP FUNCTION guard_archived_person(); DROP FUNCTION guard_site_archive(); DROP FUNCTION fylkren_site_context(text,jsonb);");
    }
}
