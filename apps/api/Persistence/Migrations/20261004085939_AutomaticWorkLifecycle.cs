using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AutomaticWorkLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "automation_paused",
                table: "information_lifecycle",
                type: "boolean",
                nullable: false,
                defaultValue: false);
            migrationBuilder.Sql("""
CREATE INDEX automatic_terminal_work ON work_items(id) WHERE status IN ('completed','rejected','cancelled','reassigned');
CREATE OR REPLACE FUNCTION guard_work_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE roots uuid[]; root uuid; ancestor record; learning_treatment boolean := false;
BEGIN
 IF TG_TABLE_NAME = 'work_items' AND TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'Irreversible disposition is disabled.' USING ERRCODE = '23514', CONSTRAINT = 'work_lifecycle_guard';
 END IF;
 roots := fylkren_work_context(TG_TABLE_NAME, CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END)
       || fylkren_work_context(TG_TABLE_NAME, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
 learning_treatment := TG_TABLE_NAME = 'learning_entries' AND TG_OP = 'INSERT'
   OR TG_TABLE_NAME = 'learning_lessons' AND TG_OP = 'UPDATE' AND
     (to_jsonb(NEW) - ARRAY['status','priority','action_plan','treatment_note','due_on','owner_person_id','owner_name','updated_at','version'])
       IS NOT DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','priority','action_plan','treatment_note','due_on','owner_person_id','owner_name','updated_at','version']);
 IF (TG_TABLE_NAME = 'work_items' OR cardinality(roots) > 0)
   AND current_setting('fylkren.activity_writer', true) IS DISTINCT FROM '1' THEN
   RAISE EXCEPTION 'This schema requires a supported activity writer.' USING ERRCODE = '23514', CONSTRAINT = 'activity_writer_gate';
 END IF;
 FOR root IN SELECT DISTINCT unnest(roots) ORDER BY 1 LOOP
   FOR ancestor IN WITH RECURSIVE chain AS (SELECT id, parent_work_item_id, site_id FROM work_items WHERE id = root
     UNION SELECT w.id, w.parent_work_item_id, w.site_id FROM work_items w JOIN chain c ON w.id = c.parent_work_item_id AND w.site_id = c.site_id)
     SELECT id FROM chain ORDER BY id LOOP
     PERFORM id FROM work_items WHERE id = ancestor.id FOR UPDATE;
     IF NOT learning_treatment AND EXISTS (SELECT 1 FROM information_lifecycle WHERE resource_type = 'work_item' AND resource_id = ancestor.id AND stage <> 'active') THEN
       RAISE EXCEPTION 'Closed or archived information cannot be changed.' USING ERRCODE = '23514', CONSTRAINT = 'work_lifecycle_guard';
     END IF;
   END LOOP;
 END LOOP;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
UPDATE information_lifecycle l SET automation_paused=true WHERE l.resource_type='work_item' AND l.stage='active' AND EXISTS(SELECT 1 FROM domain_events e WHERE e.context_work_item_id=l.resource_id AND e.activity_type='information.restored' AND e.activity_metadata_json->>'status'='active');
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DO $$ BEGIN IF EXISTS(SELECT 1 FROM domain_events WHERE actor_system='work-lifecycle-automation') OR EXISTS(SELECT 1 FROM information_lifecycle WHERE automation_paused) THEN RAISE EXCEPTION 'Automatic lifecycle requires a forward fix.' USING ERRCODE='23514',CONSTRAINT='activity_cutover_forward_fix_required'; END IF; END $$;
DROP INDEX automatic_terminal_work;
CREATE OR REPLACE FUNCTION guard_work_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
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
            migrationBuilder.DropColumn(
                name: "automation_paused",
                table: "information_lifecycle");
        }
    }
}
