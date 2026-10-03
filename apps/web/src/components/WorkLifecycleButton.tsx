import { useEffect, useId, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { useTranslation } from "../localization/LocalizationProvider";
import { PreservationControls } from "./PreservationControls";
import { ExportHandoff } from "./ExportHandoff";
import { ArchiveCustodians } from "./ArchiveCustodians";
import { Modal } from "./Modal";
import type { MessageKey } from "../localization";

type Stage = "active" | "closed" | "archived";
type State = { stage: Stage; version: number; held: boolean; effectiveStage?: Stage; inheritedLock?: boolean; impact?: { eligible: boolean; blockers: Record<string, number> } };
const descriptions: Record<Stage, MessageKey> = {
  active: "lifecycleActiveDescription",
  closed: "lifecycleClosedDescription",
  archived: "lifecycleArchivedDescription",
};

const labels: Record<Stage, MessageKey> = {
  active: "lifecycleStateActive", closed: "lifecycleStateClosed", archived: "lifecycleStateArchived",
};

const blockers: Record<string, MessageKey> = {
  active_site: "activeSite", active_child_sites: "navSites", unfinished_work: "navTasks", open_learning: "navLearning", open_plans: "navPlanning",
  open_execution: "navExecution", open_risks: "tasksTaskCardPresentationRisk", pending_notifications: "navNotifications", pending_webhooks: "webhooks",
  pending_projection: "activityTitle", pending_federation: "navFederation", missing_custodian: "archiveCustodian", archive_responsibility: "archiveCustodian",
  active_person: "active", active_login: "username", active_memberships: "navSites", active_manager: "siteManagers", active_roles: "roles",
};

export function WorkLifecycleButton({ siteId, itemId }: { siteId: string; itemId: string }) {
  return <LifecycleAction path={`/api/information/sites/${siteId}/work-items/${itemId}`} />;
}

export function GovernanceLifecycleButton({ kind, id }: { kind: "site" | "person"; id: string }) {
  return <LifecycleAction path={`/api/information/governance/${kind}/${id}`} governance={{ kind, id }} siteId={kind === "site" ? id : undefined} />;
}

function LifecycleAction({ path, governance, siteId }: { path: string; governance?: { kind: "site" | "person"; id: string }; siteId?: string }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setState(undefined); setError("");
    const refresh = () => {
      apiGet<State>(path, t("activityLoadFailed"), { signal: controller.signal }).then(value => {
        if (!controller.signal.aborted) { setState(value); setError(""); }
      }).catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      });
    };
    refresh();
    window.addEventListener("fylkren:work-changed", refresh);
    return () => { controller.abort(); window.removeEventListener("fylkren:work-changed", refresh); };
  }, [path, t]);
  return <><button className="task-icon-action" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">▣</i><span>{t("lifecycleTitle")}{state && <> · {t(labels[state.effectiveStage ?? state.stage])}</>}</span></button>{open && <LifecycleDialog path={path} governance={governance} siteId={siteId} state={state} loadError={error} onChange={setState} onClose={() => setOpen(false)} />}</>;
}

function LifecycleDialog({ path, governance, siteId, state, loadError, onChange, onClose }: { path: string; governance?: { kind: "site" | "person"; id: string }; siteId?: string; state?: State; loadError: string; onChange: (state: State) => void; onClose: () => void }) {
  const t = useTranslation();
  const reasonHelpId = useId();
  const actionId = useId();
  const reasonId = useId();
  const [selected, setSelected] = useState<Stage>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const actions: [Stage, MessageKey][] = state?.stage === "active"
    ? [["closed", "lifecycleClosed"]]
    : state?.stage === "closed"
      ? [["archived", "lifecycleArchived"], ["active", "lifecycleReopen"]]
      : [["closed", "lifecycleRestore"]];
  const action = actions.find(([stage]) => stage === selected) ?? actions[0];

  async function transition() {
    if (!state || saving) return;
    setSaving(true); setError("");
    try {
      const result = await apiMutate<{ stage: Stage; version: number }>(`${path}/transitions`, "POST", { stage: action[0], expectedVersion: state.version, reason: reason.replace(/[\r\n\t]+/g, " ").trim() }, t("activityLoadFailed"));
      onChange({ ...state, ...result, effectiveStage: result.stage }); setSelected(undefined); setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : t("activityLoadFailed")); }
    finally { setSaving(false); }
  }

  return <Modal title={t("lifecycleTitle")} onClose={onClose} dismissible={!saving}>
    {(error || loadError) && <p role="alert">{error || loadError}</p>}
    {!state ? !loadError && <p role="status">{t("loading")}</p> : <>
      <p role="status"><strong>{t(labels[state.effectiveStage ?? state.stage])}</strong></p>
      <p className="muted">{t(state.inheritedLock ? "lifecycleInheritedLock" : governance && state.stage === "active" ? "lifecycleGovernanceHelp" : descriptions[state.stage])}</p>
      {state.held && <p role="note">{t("lifecycleHeldNotice")}</p>}
      {governance && state.impact && !state.impact.eligible && <div><strong>{t("lifecycleBlocked")}</strong><ul>{Object.entries(state.impact.blockers).map(([code, count]) => <li key={code}>{t(blockers[code] ?? "activityUnknown")} ({count})</li>)}</ul></div>}
      {siteId && <ArchiveCustodians siteId={siteId} onChanged={() => { void apiGet<State>(path, t("activityLoadFailed")).then(onChange); }} />}
      {governance && <PreservationControls kind={governance.kind} id={governance.id} onChanged={() => { void apiGet<State>(path, t("activityLoadFailed")).then(onChange); }} />}
      {siteId && <ExportHandoff siteId={siteId} />}
      <div className="field">
        <label htmlFor={actionId}>{t("lifecycleAction")}</label>
        <select id={actionId} value={action[0]} disabled={saving || state.held || state.inheritedLock} onChange={e => { setSelected(e.target.value as Stage); setReason(""); }}>
          {actions.map(([stage, key]) => <option key={stage} value={stage}>{t(key)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={reasonId}>{t("lifecycleReason")}: {t(action[1])}</label>
        <textarea id={reasonId} rows={3} required maxLength={1000} disabled={saving || state.held || state.inheritedLock} aria-describedby={reasonHelpId} value={reason} onChange={e => setReason(e.target.value)} />
        <p id={reasonHelpId} className="muted">{t("lifecycleReasonHelp")}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>{t("cancel")}</button>
        <button type="button" disabled={saving || state.held || state.inheritedLock || !reason.trim() || governance && action[0] !== "active" && state.impact && !state.impact.eligible} onClick={() => void transition()}>{t(action[1])}</button>
      </div>
    </>}
  </Modal>;
}
