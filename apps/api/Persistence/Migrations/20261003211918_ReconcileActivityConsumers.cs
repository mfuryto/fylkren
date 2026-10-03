using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReconcileActivityConsumers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "reconciled_at",
                table: "notification_projection_cursors",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "domain_event_id",
                table: "api_machine_audit_events",
                type: "uuid",
                nullable: true);
            migrationBuilder.Sql("""
-- Only genuinely pending legacy v1 webhook work is moved; history is not replayed.
INSERT INTO event_projections(consumer,domain_event_id,status,attempt_count,next_attempt_at,completed_at)
SELECT 'webhooks',id,
 CASE WHEN event_type IN ('task.created','task.completed','assignment.created','plan.approved','execution.started','decision.recorded') THEN 'pending' ELSE 'skipped' END,
 0,now(),CASE WHEN event_type IN ('task.created','task.completed','assignment.created','plan.approved','execution.started','decision.recorded') THEN NULL ELSE now() END
FROM domain_events WHERE source='legacy' AND webhooks_projected_at IS NULL
ON CONFLICT(consumer,domain_event_id) DO NOTHING;
CREATE FUNCTION guard_consumer_cutover() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE work_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM notification_projection_cursors WHERE reconciled_at IS NOT NULL) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='domain_events' THEN
  IF NEW.source='legacy' THEN RAISE EXCEPTION 'New activity requires the common recorder after cutover.' USING ERRCODE='23514',CONSTRAINT='activity_consumer_cutover'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='audit_events' AND NEW.domain_event_id IS NULL AND NEW.event_type IN
  ('work-item.registered','work-item.delegated','work-item.processing-delegated','work-item.reassignment-created',
   'work-item.received-from-parent-site','work-item.request-received','work-item.internal-request-received',
   'workflow.submitted-for-approval','execution.submitted-for-review','work-item.completed','work-item.final-report-updated',
   'work-item.assigned','work-item.under_review','work-item.in_progress','work-item.planning','work-item.execution',
   'work-item.on_hold','work-item.rejected','work-item.request-cancelled-by-sender') THEN
  IF NEW.entity_type='work-item' THEN work_id := NEW.entity_id;
  ELSIF NEW.entity_type='workflow-run' THEN SELECT work_item_id INTO work_id FROM workflow_runs WHERE id=NEW.entity_id;
  ELSIF NEW.entity_type='execution-run' THEN SELECT work_item_id INTO work_id FROM execution_runs WHERE id=NEW.entity_id; END IF;
  IF EXISTS(SELECT 1 FROM work_items WHERE id=work_id AND site_id=NEW.site_id) THEN
   RAISE EXCEPTION 'Operational notification facts require common event correlation.' USING ERRCODE='23514',CONSTRAINT='activity_consumer_cutover';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER activity_consumer_cutover BEFORE INSERT ON domain_events FOR EACH ROW EXECUTE FUNCTION guard_consumer_cutover();
CREATE TRIGGER audit_consumer_cutover BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION guard_consumer_cutover();
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DO $$ BEGIN IF EXISTS(SELECT 1 FROM notification_projection_cursors WHERE reconciled_at IS NOT NULL)
 OR EXISTS(SELECT 1 FROM api_machine_audit_events WHERE domain_event_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM domain_events WHERE source <> 'legacy' AND context_work_item_id IS NOT NULL)
 THEN RAISE EXCEPTION 'Consumer cutover requires a forward fix.' USING ERRCODE='23514',CONSTRAINT='activity_cutover_forward_fix_required'; END IF; END $$;
DROP TRIGGER activity_consumer_cutover ON domain_events;
DROP TRIGGER audit_consumer_cutover ON audit_events;
DROP FUNCTION guard_consumer_cutover();
-- Pre-cutover rollback returns only the migration-created compatibility markers.
DELETE FROM event_projections p USING domain_events e WHERE p.domain_event_id=e.id AND p.consumer='webhooks' AND e.source='legacy';
""");
            migrationBuilder.DropColumn(
                name: "reconciled_at",
                table: "notification_projection_cursors");

            migrationBuilder.DropColumn(
                name: "domain_event_id",
                table: "api_machine_audit_events");
        }
    }
}
