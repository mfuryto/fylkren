import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { useTranslation } from "../localization/LocalizationProvider";
import { Modal } from "./Modal";
import type { MessageKey } from "../localization";
type State = { stage: "active" | "closed" | "archived"; version: number; held: boolean };
export function WorkLifecycleButton({ siteId, itemId }: { siteId: string; itemId: string }) {
  const t = useTranslation(); const [open, setOpen] = useState(false);
  return <><button className="task-icon-action" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">▣</i><span>{t("lifecycleTitle")}</span></button>{open && <LifecycleDialog siteId={siteId} itemId={itemId} onClose={() => setOpen(false)} />}</>;
}
function LifecycleDialog({ siteId, itemId, onClose }: { siteId: string; itemId: string; onClose: () => void }) {
  const t = useTranslation(); const [state, setState] = useState<State>(); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const path = `/api/information/sites/${siteId}/work-items/${itemId}`;
  useEffect(() => { const controller = new AbortController(); apiGet<State>(path, t("activityLoadFailed"), { signal: controller.signal }).then(setState).catch(e => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [path, t]);
  async function transition(stage: State["stage"]) {
    if (!state || saving) return; setSaving(true); setError("");
    try { const result = await apiMutate<{ stage: State["stage"]; version: number }>(`${path}/transitions`, "POST", { stage, expectedVersion: state.version, reason }, t("activityLoadFailed")); setState({ ...state, ...result }); setReason(""); }
    catch (e) { setError(e instanceof Error ? e.message : t("activityLoadFailed")); } finally { setSaving(false); }
  }
  const actions: [State["stage"], MessageKey][] = state?.stage === "active" ? [["closed", "lifecycleClosed"]] : state?.stage === "closed" ? [["archived", "lifecycleArchived"], ["active", "lifecycleReopen"]] : [["closed", "lifecycleRestore"]];
  return <Modal title={t("lifecycleTitle")} onClose={onClose}>{error && <p role="alert">{error}</p>}{!state ? <p role="status">{t("loading")}</p> : <><label>{t("lifecycleReason")}<textarea rows={3} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>{t("close")}</button>{actions.map(([stage, key]) => <button type="button" className="secondary-button" key={stage} disabled={saving || state.held || !reason.trim()} onClick={() => void transition(stage)}>{t(key)}</button>)}</div></>}</Modal>;
}
