import { useEffect, useId, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { useTranslation } from "../localization/LocalizationProvider";

type Policy = { policyId: string; version: number; name: string; category: string; reviewAfterDays: number | null };
type Hold = { id: string; reason: string; releasedAt: string | null };
type State = { version: number; held: boolean; policyId: string | null; policyVersion: number | null; holds: Hold[] };
export function PreservationControls({ kind, id, onChanged }: { kind: "site" | "person"; id: string; onChanged: () => void }) {
  const t = useTranslation(); const field = useId(); const root = `/api/information/preservation/${kind}/${id}`;
  const [state, setState] = useState<State>(); const [policies, setPolicies] = useState<Policy[]>([]); const [selected, setSelected] = useState("");
  const [name, setName] = useState(""); const [days, setDays] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function refresh() {
    const [value, rules] = await Promise.all([apiGet<State>(root, t("activityLoadFailed")), apiGet<Policy[]>("/api/information/preservation/policies", t("activityLoadFailed"))]);
    setState(value); setPolicies(rules.filter(p => p.category === "content")); setSelected(value.policyId ? `${value.policyId}:${value.policyVersion}` : "");
  }
  useEffect(() => { let current = true; Promise.all([apiGet<State>(root, t("activityLoadFailed")), apiGet<Policy[]>("/api/information/preservation/policies", t("activityLoadFailed"))]).then(([value, rules]) => { if (current) { setState(value); setPolicies(rules.filter(p => p.category === "content")); setSelected(value.policyId ? `${value.policyId}:${value.policyVersion}` : ""); } }).catch(e => { if (current) setError(e.message); }); return () => { current = false; }; }, [root, t]);
  async function act(action: "hold" | "release" | "bind" | "create", hold?: Hold) {
    if (!state || busy || !reason.trim()) return;
    setBusy(true); setError(""); const explanation = reason.replace(/[\r\n\t]+/g, " ").trim();
    try {
      if (action === "create") {
        await apiMutate("/api/information/preservation/policies", "POST", { expectedVersion: 0, name, category: "content", reviewAfterDays: days ? Number(days) : null, reason: explanation }, t("siteActionFailed"));
        setName(""); setDays("");
      } else {
        const rule = policies.find(p => `${p.policyId}:${p.version}` === selected);
        await apiMutate(`${root}/${action === "bind" ? "policy" : action === "release" ? `holds/${hold!.id}/release` : "holds"}`, "POST", { expectedVersion: state.version, reason: explanation, ...(action === "bind" && rule ? { policyId: rule.policyId, policyVersion: rule.version } : {}) }, t("siteActionFailed"));
      }
      await refresh(); setReason(""); onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="preservation-controls"><summary>{t("preservationTitle")}{state?.held && <> · {t("preservationHold")}</>}</summary><div className="stacked-form">
    <p className="muted">{t("preservationNoExecution")}</p>{error && <p role="alert">{error}</p>}
    <div className="field"><label htmlFor={`${field}-reason`}>{t("lifecycleReason")}</label><textarea id={`${field}-reason`} rows={2} maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>
    <button type="button" className="secondary-button" disabled={!state || busy || !reason.trim()} onClick={() => void act("hold")}>{t("add")} · {t("preservationHold")}</button>
    {state?.holds.map(hold => <div key={hold.id}><p>{hold.reason}</p>{hold.releasedAt ? <span className="muted">{t("preservationRelease")} · {new Date(hold.releasedAt).toLocaleDateString()}</span> : <button type="button" className="text-button" disabled={busy || !reason.trim()} onClick={() => void act("release", hold)}>{t("preservationRelease")}</button>}</div>)}
    <div className="field"><label htmlFor={`${field}-policy`}>{t("preservationPolicy")}</label><select id={`${field}-policy`} value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}><option value="">—</option>{policies.map(p => <option key={`${p.policyId}:${p.version}`} value={`${p.policyId}:${p.version}`}>{p.name} ({p.version})</option>)}</select></div>
    <button type="button" className="secondary-button" disabled={!state || busy || !reason.trim() || !policies.some(p => `${p.policyId}:${p.version}` === selected)} onClick={() => void act("bind")}>{t("save")}</button>
    <details><summary>{t("add")} · {t("preservationPolicy")}</summary><div className="field"><label htmlFor={`${field}-name`}>{t("name")}</label><input id={`${field}-name`} maxLength={200} value={name} onChange={e => setName(e.target.value)} /></div><div className="field"><label htmlFor={`${field}-days`}>{t("preservationReviewDays")}</label><input id={`${field}-days`} type="number" min={1} max={36500} value={days} onChange={e => setDays(e.target.value)} /></div><button type="button" disabled={busy || !name.trim() || !reason.trim() || days !== "" && (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 36500)} onClick={() => void act("create")}>{t("add")}</button></details>
  </div></details>;
}
