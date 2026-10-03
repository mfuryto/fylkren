import { useEffect, useId, useState } from "react";
import { apiGet } from "../api/client";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";
import type { MessageKey } from "../localization";
import { Modal } from "./Modal";

const labels: Record<string, MessageKey> = {
  "task.created": "auditWorkRegistered", "task.completed": "taskStatusCompleted", "assignment.created": "auditWorkDelegated",
  "assignment.progress_received": "templateWorkChanged", "assignment.cancellation_queued": "pending", "report.received": "receivedRequests", "assignment.dispatch_queued": "pending", "assignment.sent": "sentRequests", "assignment.received": "receivedRequests",
  "assignment.accepted": "taskStatusUnderReview", "assignment.started": "taskStatusInProgress", "assignment.updated": "templateWorkChanged",
  "assignment.completed": "taskStatusCompleted", "assignment.cancelled": "taskStatusCancelled", "assignment.reassigned": "auditWorkReassigned",
  "assignment.claimed": "responsibilityClaimed", "assignment.released": "auditWorkflowReleased", "assignment.reopened": "lifecycleReopen",
  "plan.published": "auditPlanApproved", "plan.updated": "auditPlanningStepDocumented", "plan.submitted": "taskStatusPlanningApproval",
  "execution.started": "auditExecutionStarted", "execution.updated": "auditExecutionStepDocumented", "execution.submitted": "auditExecutionSubmitted",
  "decision.created": "auditDecisionCreated", "decision.updated": "auditDecisionRevised",
  "risk.created": "activityRiskCreated", "risk.updated": "activityRiskUpdated", "risk.closed": "activityRiskClosed",
  "measure.created": "activityMeasureCreated", "measure.updated": "activityMeasureUpdated", "measure.completed": "activityMeasureCompleted",
  "comment.created": "taskCommentAdded", "learning.created": "auditLearningAdded", "learning.updated": "auditLearningReviewed", "learning.comment_added": "auditLearningCommentAdded",
  "report.updated": "auditFinalReportUpdated", "report.approved": "auditFinalReportApproved",
  "site.created": "auditSiteCreated", "site.updated": "auditSiteUpdated", "site.deactivated": "auditSiteDeactivated", "membership.deactivated": "auditSiteMemberDeactivated",
  "information.closed": "lifecycleClosed", "information.archived": "lifecycleArchived", "information.restored": "lifecycleRestore",
};
export type ActivityRow = { id: string; type: string | null; occurredAt: string; source: string; actorKind: string; actorName?: string | null; workReference?: string; contextWorkItemId: string };
type Page = { items: ActivityRow[]; hasMore: boolean; next: { before: string; beforeId: string } | null };
type Props = { siteId: string; itemId?: string; title?: string; timeZone?: string; archive?: boolean };
export function ActivityButton(props: Props) {
  const t = useTranslation(); const [open, setOpen] = useState(false);
  return <><button type="button" className="task-icon-action" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">◷</i><span>{t("activityTitle")}</span></button>
    {open && <Modal title={t("activityTitle")} onClose={() => setOpen(false)}><strong>{props.title}</strong><ActivityTimeline {...props} /></Modal>}</>;
}
export function ActivityEntry({ row, timeZone, siteId }: { row: ActivityRow; timeZone?: string; siteId?: string }) {
  const t = useTranslation(); const language = useLanguage();
  return <li><strong>{t(labels[row.type ?? ""] ?? "activityUnknown")}</strong> <time dateTime={row.occurredAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(row.occurredAt))}</time>
    {siteId && row.workReference && <a href={`/#/tasks?site=${encodeURIComponent(siteId)}&item=${encodeURIComponent(row.contextWorkItemId)}`}> · {row.workReference}</a>}
    {row.actorName && <span> · {row.actorName}</span>}</li>;
}
export function ActivityTimeline({ siteId, itemId, timeZone, archive }: Props) {
  const t = useTranslation(); const field = useId();
  const [type, setType] = useState(""); const [resource, setResource] = useState(""); const [from, setFrom] = useState(""); const [until, setUntil] = useState("");
  const [cursor, setCursor] = useState<Page["next"]>(null); const [history, setHistory] = useState<Page["next"][]>([]); const [data, setData] = useState<Page>({ items: [], hasMore: false, next: null }); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setData({ items: [], hasMore: false, next: null });
    const query = new URLSearchParams(); if (itemId) query.set("workItemId", itemId); if (type) query.set("eventType", type); if (resource) query.set("resourceType", resource);
    if (from) query.set("from", `${from}T00:00:00Z`); if (until) query.set("until", new Date(new Date(`${until}T00:00:00Z`).getTime() + 86_400_000).toISOString());
    if (cursor) { query.set("before", cursor.before); query.set("beforeId", cursor.beforeId); }
    apiGet<Page>(`${archive ? `/api/information/archives/${siteId}/activity` : `/api/activity/sites/${siteId}`}?${query}`, t("activityLoadFailed"), { signal: controller.signal })
      .then(setData).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t("activityLoadFailed")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, itemId, type, resource, from, until, cursor, t, archive]);
  function reset(change: () => void) { setCursor(null); setHistory([]); change(); }
  return <section><p className="muted">{t("activityLegacyNotice")}</p><div className="report-toolbar">
    <label htmlFor={`${field}-type`}>{t("auditEvent")}<select id={`${field}-type`} value={type} onChange={e => reset(() => setType(e.target.value))}><option value="">{t("allEvents")}</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
    <label htmlFor={`${field}-resource`}>{t("auditArea")}<select id={`${field}-resource`} value={resource} onChange={e => reset(() => setResource(e.target.value))}><option value="">{t("all")}</option>{([['work_item', 'entityWork'], ['task', 'entityWork'], ['plan', 'entityWorkflowRun'], ['execution', 'entityExecutionRun'], ['report', 'reportsTitle'], ['decision', 'approvalDecision'], ['risk', 'tasksTaskCardPresentationRisk'], ['measure', 'mitigations'], ['comment', 'taskCommentsTitle'], ['learning', 'navLearning'], ['site', 'navSites'], ['person', 'entityPerson']] as const).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
    <label htmlFor={`${field}-from`}>{t("fromDate")} (UTC)<input id={`${field}-from`} type="date" value={from} onChange={e => reset(() => setFrom(e.target.value))} /></label>
    <label htmlFor={`${field}-until`}>{t("toDate")} (UTC)<input id={`${field}-until`} type="date" min={from} value={until} onChange={e => reset(() => setUntil(e.target.value))} /></label>
  </div>{error && <p role="alert">{error}</p>}{loading ? <p role="status">{t("loading")}</p> : <><ol className="task-comment-list">{data.items.map(row => <ActivityEntry key={row.id} row={row} timeZone={timeZone} siteId={archive ? undefined : siteId} />)}</ol>{!data.items.length && <p>{t("noAuditMatches")}</p>}
    <div className="modal-actions"><button type="button" className="secondary-button" disabled={!history.length} onClick={() => { setCursor(history.at(-1) ?? null); setHistory(history.slice(0, -1)); }}>{t("previous")}</button><button type="button" className="secondary-button" disabled={!data.hasMore} onClick={() => { setHistory([...history, cursor]); setCursor(data.next); }}>{t("next")}</button></div></>}
  </section>;
}
