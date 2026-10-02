using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261002220000_WorkActivityArchiveGuards")]
public sealed class WorkActivityArchiveGuards : Migration
{
    private static readonly string[] Tables = ["work_items", "workflow_runs", "execution_runs", "workflow_plan_allocations", "workflow_plan_requests", "planning_rfi_entries",
        "workflow_step_documents", "workflow_step_links", "workflow_timeline_events", "execution_step_documents", "execution_external_requests", "execution_timeline_events",
        "work_item_dependencies", "work_item_comments", "learning_lessons", "learning_entries", "risks", "risk_revisions", "risk_mitigations", "risk_mitigation_revisions",
        "decision_references", "decision_revisions", "decision_makers", "domain_object_versions", "formal_approval_signoffs"];
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
CREATE FUNCTION fylkren_work_context(kind text, row_data jsonb) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE root uuid; object_kind text; object_id uuid; related jsonb; result uuid[] := '{}'; ref record;
BEGIN
 IF row_data IS NULL THEN RETURN result; END IF;
 IF kind = 'work_items' THEN
   SELECT id INTO root FROM work_items WHERE id = (row_data->>'parent_work_item_id')::uuid
     AND site_id = (row_data->>'site_id')::uuid;
   result := ARRAY[(row_data->>'id')::uuid, root];
 ELSIF row_data ? 'work_item_id' OR row_data ? 'context_work_item_id' THEN
   result := ARRAY[COALESCE((row_data->>'work_item_id')::uuid, (row_data->>'context_work_item_id')::uuid)];
 ELSIF row_data ? 'predecessor_work_item_id' THEN
   result := ARRAY[(row_data->>'predecessor_work_item_id')::uuid, (row_data->>'dependent_work_item_id')::uuid];
 ELSIF row_data ? 'run_id' THEN
   SELECT work_item_id INTO root FROM workflow_runs WHERE id = (row_data->>'run_id')::uuid;
   IF root IS NULL THEN SELECT work_item_id INTO root FROM execution_runs WHERE id = (row_data->>'run_id')::uuid; END IF;
   result := ARRAY[root];
 ELSIF row_data ? 'lesson_id' THEN
   SELECT work_item_id INTO root FROM learning_lessons WHERE id = (row_data->>'lesson_id')::uuid; result := ARRAY[root];
 ELSIF row_data ? 'version_id' THEN
   SELECT context_work_item_id INTO root FROM domain_object_versions WHERE id = (row_data->>'version_id')::uuid; result := ARRAY[root];
 ELSIF kind IN ('risks', 'decision_references') THEN
   object_kind := row_data->>'object_type'; object_id := (row_data->>'object_id')::uuid;
   IF object_kind IN ('task', 'assignment', 'work-item') THEN root := object_id;
   ELSIF object_kind = 'plan' THEN SELECT work_item_id INTO root FROM workflow_runs WHERE id = object_id;
   ELSIF object_kind = 'execution' THEN SELECT work_item_id INTO root FROM execution_runs WHERE id = object_id; END IF;
   result := ARRAY[root];
 ELSIF row_data ? 'risk_id' THEN
   SELECT to_jsonb(r) INTO related FROM risks r WHERE id = (row_data->>'risk_id')::uuid;
   result := fylkren_work_context('risks', related);
 ELSIF row_data ? 'mitigation_id' THEN
   SELECT to_jsonb(r) INTO related FROM risk_mitigations r WHERE id = (row_data->>'mitigation_id')::uuid;
   result := fylkren_work_context('risk_mitigations', related);
 ELSIF kind IN ('decision_revisions', 'decision_makers') THEN
   FOR ref IN SELECT dr.* FROM decision_references dr JOIN decision_revisions rev ON rev.id = dr.revision_id
     WHERE rev.decision_id = COALESCE((row_data->>'decision_id')::uuid, (SELECT decision_id FROM decision_revisions WHERE id = (row_data->>'revision_id')::uuid)) LOOP
     result := result || fylkren_work_context('decision_references', to_jsonb(ref));
   END LOOP;
 END IF;
 RETURN array_remove(result, NULL);
END $$;
CREATE FUNCTION guard_domain_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'webhooks_projected_at') IS DISTINCT FROM (to_jsonb(OLD) - 'webhooks_projected_at') THEN
   RAISE EXCEPTION 'Domain activity is immutable.' USING ERRCODE = '23514', CONSTRAINT = 'domain_activity_immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER domain_activity_guard BEFORE INSERT OR UPDATE OR DELETE ON domain_events FOR EACH ROW EXECUTE FUNCTION guard_domain_activity();
CREATE FUNCTION guard_activity_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.source <> 'legacy' AND NEW.context_work_item_id IS NOT NULL AND NOT EXISTS
   (SELECT 1 FROM work_items WHERE id = NEW.context_work_item_id AND site_id = NEW.site_id) THEN
   RAISE EXCEPTION 'Activity owner must match its context.' USING ERRCODE = '23514', CONSTRAINT = 'activity_context_owner';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER activity_owner_guard AFTER INSERT OR UPDATE ON domain_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_activity_owner();
CREATE FUNCTION guard_work_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE roots uuid[]; root uuid; ancestor record;
BEGIN
 IF TG_TABLE_NAME = 'work_items' AND TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'Irreversible disposition is disabled.' USING ERRCODE = '23514', CONSTRAINT = 'work_lifecycle_guard';
 END IF;
 roots := fylkren_work_context(TG_TABLE_NAME, CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END)
       || fylkren_work_context(TG_TABLE_NAME, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
 IF (TG_TABLE_NAME = 'work_items' OR cardinality(roots) > 0)
   AND current_setting('fylkren.activity_writer', true) IS DISTINCT FROM '1' THEN
   RAISE EXCEPTION 'This schema requires a supported activity writer.' USING ERRCODE = '23514', CONSTRAINT = 'activity_writer_gate';
 END IF;
 FOR root IN SELECT DISTINCT unnest(roots) ORDER BY 1 LOOP
   FOR ancestor IN WITH RECURSIVE chain AS (SELECT id, parent_work_item_id, site_id FROM work_items WHERE id = root
     UNION SELECT w.id, w.parent_work_item_id, w.site_id FROM work_items w JOIN chain c ON w.id = c.parent_work_item_id AND w.site_id = c.site_id)
     SELECT id FROM chain ORDER BY id LOOP
     PERFORM id FROM work_items WHERE id = ancestor.id FOR UPDATE;
     IF EXISTS (SELECT 1 FROM information_lifecycle WHERE resource_type = 'work_item' AND resource_id = ancestor.id AND stage <> 'active') THEN
       RAISE EXCEPTION 'Closed or archived information cannot be changed.' USING ERRCODE = '23514', CONSTRAINT = 'work_lifecycle_guard';
     END IF;
   END LOOP;
 END LOOP;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
""");
        foreach (var table in Tables)
            migrationBuilder.Sql($"CREATE TRIGGER work_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION guard_work_lifecycle();");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM domain_events WHERE source <> 'legacy' AND context_work_item_id IS NOT NULL) THEN RAISE EXCEPTION 'Activity cutover requires a forward fix; downgrade is disabled.' USING ERRCODE = '23514', CONSTRAINT = 'activity_cutover_forward_fix_required'; END IF; END $$;");
        foreach (var table in Tables) migrationBuilder.Sql($"DROP TRIGGER work_lifecycle_guard ON {table};");
        migrationBuilder.Sql("DROP TRIGGER activity_owner_guard ON domain_events; DROP FUNCTION guard_activity_owner(); DROP TRIGGER domain_activity_guard ON domain_events; DROP FUNCTION guard_domain_activity(); DROP FUNCTION guard_work_lifecycle(); DROP FUNCTION fylkren_work_context(text, jsonb);");
    }
}
