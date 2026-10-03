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

const labels: Record<Stage, MessageKey> = {
  active: "lifecycleStateActive", closed: "lifecycleStateClosed", archived: "lifecycleStateArchived",
};

export function WorkLifecycleButton({ siteId, itemId }: { siteId: string; itemId: string }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>();
  const [error, setError] = useState("");
  const path = `/api/information/sites/${siteId}/work-items/${itemId}`;
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
  return <><button className="task-icon-action" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">▣</i><span>{t("lifecycleTitle")}{state && <> · {t(labels[state.stage])}</>}</span></button>{open && <LifecycleDialog path={path} state={state} loadError={error} onChange={setState} onClose={() => setOpen(false)} />}</>;
}

function LifecycleDialog({ path, state, loadError, onChange, onClose }: { path: string; state?: State; loadError: string; onChange: (state: State) => void; onClose: () => void }) {
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
      onChange({ ...state, ...result }); setSelected(undefined); setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : t("activityLoadFailed")); }
    finally { setSaving(false); }
  }

  return <Modal title={t("lifecycleTitle")} onClose={onClose} dismissible={!saving}>
    {(error || loadError) && <p role="alert">{error || loadError}</p>}
    {!state ? !loadError && <p role="status">{t("loading")}</p> : <>
      <p role="status"><strong>{t(labels[state.stage])}</strong></p>
      <p className="muted">{t(descriptions[state.stage])}</p>
      {state.held && <p role="note">{t("lifecycleHeldNotice")}</p>}
      <div className="field">
        <label htmlFor={actionId}>{t("lifecycleAction")}</label>
        <select id={actionId} value={action[0]} disabled={saving || state.held} onChange={e => { setSelected(e.target.value as Stage); setReason(""); }}>
          {actions.map(([stage, key]) => <option key={stage} value={stage}>{t(key)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={reasonId}>{t("lifecycleReason")}: {t(action[1])}</label>
        <textarea id={reasonId} rows={3} required maxLength={1000} disabled={saving || state.held} aria-describedby={reasonHelpId} value={reason} onChange={e => setReason(e.target.value)} />
        <p id={reasonHelpId} className="muted">{t("lifecycleReasonHelp")}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>{t("cancel")}</button>
        <button type="button" disabled={saving || state.held || !reason.trim()} onClick={() => void transition()}>{t(action[1])}</button>
      </div>
    </>}
  </Modal>;
}
