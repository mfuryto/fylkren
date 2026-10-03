import { useEffect, useId, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { loadGlobalUsers } from "../identity/identityApi";
import type { GlobalUser } from "../identity/models";
import { useTranslation } from "../localization/LocalizationProvider";

type Grant = { id: string; personId: string; canExport: boolean; isActive: boolean; version: number; name: string };
export function ArchiveCustodians({ siteId, onChanged }: { siteId: string; onChanged: () => void }) {
  const t = useTranslation(); const field = useId();
  const [query, setQuery] = useState(""); const [people, setPeople] = useState<GlobalUser[]>([]); const [selected, setSelected] = useState<GlobalUser>();
  const [canExport, setCanExport] = useState(true); const [reason, setReason] = useState(""); const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const root = `/api/information/governance/sites/${siteId}/custodians`;
  async function refresh() { setGrants(await apiGet<Grant[]>(root, t("activityLoadFailed"))); }
  useEffect(() => { let current = true; apiGet<Grant[]>(root, t("activityLoadFailed")).then(value => { if (current) setGrants(value); }).catch(e => { if (current) setError(e.message); }); return () => { current = false; }; }, [root, t]);
  async function search() { try { setPeople((await loadGlobalUsers(1, 20, query, "", "name-asc")).items.filter(p => p.isActive)); setError(""); } catch (e) { setError((e as Error).message); } }
  async function mutate(grant?: Grant) {
    if (busy || !reason.trim() || !grant && !selected) return;
    setBusy(true); setError("");
    try {
      const explanation = reason.replace(/[\r\n\t]+/g, " ").trim();
      await apiMutate(grant ? `${root}/${grant.id}/revoke` : root, "POST", grant ? { expectedVersion: grant.version, reason: explanation } : { personId: selected!.id, canExport, reason: explanation }, t("siteActionFailed"));
      await refresh(); setReason(""); setSelected(undefined); setPeople([]); onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <details><summary>{t("archiveCustodian")} ({grants.filter(g => g.isActive).length})</summary><div className="stacked-form">
    <p className="muted">{t("archiveFullSiteAccess")}</p>
    {error && <p role="alert">{error}</p>}
    <div className="field"><label htmlFor={`${field}-search`}>{t("searchForUser")}</label><input id={`${field}-search`} type="search" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <button type="button" className="secondary-button" disabled={busy || !query.trim()} onClick={() => void search()}>{t("search")}</button>
    {people.map(p => <button key={p.id} type="button" className="text-button" onClick={() => setSelected(p)}>{p.displayName}</button>)}
    {selected && <strong>{selected.displayName}</strong>}
    <label><input type="checkbox" checked={canExport} onChange={e => setCanExport(e.target.checked)} /> {t("archiveAllowExport")}</label>
    <div className="field"><label htmlFor={`${field}-reason`}>{t("lifecycleReason")}</label><textarea id={`${field}-reason`} rows={2} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></div>
    <button type="button" disabled={busy || !selected || !reason.trim()} onClick={() => void mutate()}>{t("add")}</button>
    {grants.filter(g => g.isActive).map(g => <div key={g.id}><span>{g.name} · {g.canExport ? t("archiveAllowExport") : t("archiveFullSiteAccess")}</span> <button type="button" className="text-button" disabled={busy || !reason.trim()} onClick={() => void mutate(g)}>{t("remove")}</button></div>)}
  </div></details>;
}
