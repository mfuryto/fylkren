import { useEffect, useId, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { useTranslation } from "../localization/LocalizationProvider";
import { Modal } from "./Modal";
import type { MessageKey } from "../localization";

type Stage = "active" | "closed" | "archived";
type State = { stage: Stage; version: number; held: boolean };
const descriptions: Record<Stage, MessageKey> = {
  active: "lifecycleActiveDescription",
  closed: "lifecycleClosedDescription",
  archived: "lifecycleArchivedDescription",
};

export function WorkLifecycleButton({ siteId, itemId }: { siteId: string; itemId: string }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  return <><button className="task-icon-action" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">▣</i><span>{t("lifecycleTitle")}</span></button>{open && <LifecycleDialog siteId={siteId} itemId={itemId} onClose={() => setOpen(false)} />}</>;
}

function LifecycleDialog({ siteId, itemId, onClose }: { siteId: string; itemId: string; onClose: () => void }) {
  const t = useTranslation();
  const reasonHelpId = useId();
  const [state, setState] = useState<State>();
  const [selected, setSelected] = useState<Stage>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const path = `/api/information/sites/${siteId}/work-items/${itemId}`;
  useEffect(() => {
    const controller = new AbortController();
    apiGet<State>(path, t("activityLoadFailed"), { signal: controller.signal }).then(setState).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [path, t]);

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
      const result = await apiMutate<{ stage: Stage; version: number }>(`${path}/transitions`, "POST", { stage: action[0], expectedVersion: state.version, reason }, t("activityLoadFailed"));
      setState({ ...state, ...result }); setSelected(undefined); setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : t("activityLoadFailed")); }
    finally { setSaving(false); }
  }

  return <Modal title={t("lifecycleTitle")} onClose={onClose} dismissible={!saving}>
    {error && <p role="alert">{error}</p>}
    {!state ? <p role="status">{t("loading")}</p> : <>
      <p role="status">{t(descriptions[state.stage])}</p>
      {state.held && <p role="note">{t("lifecycleHeldNotice")}</p>}
      <label>{t("lifecycleAction")}
        <select value={action[0]} disabled={saving || state.held} onChange={e => { setSelected(e.target.value as Stage); setReason(""); }}>
          {actions.map(([stage, key]) => <option key={stage} value={stage}>{t(key)}</option>)}
        </select>
      </label>
      <label>{t("lifecycleReason")}: {t(action[1])}
        <textarea rows={3} required maxLength={1000} disabled={saving || state.held} aria-describedby={reasonHelpId} value={reason} onChange={e => setReason(e.target.value)} />
      </label>
      <p id={reasonHelpId} className="muted">{t("lifecycleReasonHelp")}</p>
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>{t("cancel")}</button>
        <button type="button" disabled={saving || state.held || !reason.trim()} onClick={() => void transition()}>{t(action[1])}</button>
      </div>
    </>}
  </Modal>;
}
