import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";
import { useTranslation } from "../localization/LocalizationProvider";
import type { TaskSite } from "../work/WorkContextModels";
import type { WorkItemType } from "../work/WorkItemModels";

type LookupKind = "source-type" | "sender";
type Draft = { id: string; name: string; isActive: boolean };
const emptyDraft = (): Draft => ({ id: "", name: "", isActive: true });

function SourceList({ siteId, kind }: { siteId: string; kind: LookupKind }) {
  const t = useTranslation();
  const [values, setValues] = useState<WorkItemType[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [sort, setSort] = useState<ListSort>("name-asc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = t(kind === "source-type" ? "tasksTaskLookupDialogsSourceTypes" : "tasksTaskLookupDialogsSenders");
  const load = async () => {
    try {
      setValues(await apiGet<WorkItemType[]>(`/api/work/sites/${siteId}/lookups/${kind}`, t("tasksUseTaskDataLookupValuesCouldNotBeLoaded")));
      setError("");
    } catch (problem) { setError(errorMessage(problem, t("tasksUseTaskDataLookupValuesCouldNotBeLoaded"))); }
  };
  useEffect(() => { setDraft(emptyDraft()); void load(); }, [siteId, kind]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await apiMutate(`/api/work/sites/${siteId}/lookups/${kind}${draft.id ? `/${draft.id}` : ""}`, draft.id ? "PUT" : "POST", draft, t("tasksTasksPageTheValueCouldNotBeSaved"));
      setDraft(emptyDraft()); await load();
    } catch (problem) { setError(errorMessage(problem, t("tasksTasksPageTheValueCouldNotBeSaved"))); }
    finally { setBusy(false); }
  };
  return <section className="panel source-settings-panel">
    <div className="section-heading"><h2>{title}</h2><ListSortControl id={`source-sort-${kind}`} value={sort} onChange={setSort} options={["name-asc", "name-desc"]}/></div>
    {error && <p className="status-message error-message" role="alert">{error}</p>}
    <form className="source-settings-form" onSubmit={save}>
      <div className="field"><label htmlFor={`source-name-${kind}`}>{t("name")}</label><input id={`source-name-${kind}`} required minLength={2} maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></div>
      {draft.id && <label className="checkbox-field"><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })}/> {t("active")}</label>}
      <div className="inline-actions"><button className="primary-button" disabled={busy}>{draft.id ? t("save") : t("create")}</button>{draft.id && <button className="secondary-button" type="button" onClick={() => setDraft(emptyDraft())}>{t("cancelEditing")}</button>}</div>
    </form>
    <div className="source-settings-list">
      {sortList(values, sort, { name: value => value.name }).map(value => <div className="type-row" key={value.id}><span><strong>{value.name}</strong><small className="muted">{value.isActive ? t("active") : t("inactive")}{value.inUse ? t("inUseSuffix") : ""}</small></span><button className="link-button" type="button" onClick={() => setDraft({ id: value.id, name: value.name, isActive: value.isActive })}>{t("edit")}</button></div>)}
    </div>
  </section>;
}

export function SourcesPage() {
  const t = useTranslation();
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<{ sites: TaskSite[] }>("/api/work/context", t("tasksTaskApiTheTaskContextCouldNotBe"))
      .then(result => {
        const managed = result.sites.filter(site => site.isSiteManager);
        setSites(managed); setSiteId(current => managed.some(site => site.siteId === current) ? current : managed[0]?.siteId ?? "");
      })
      .catch(problem => setError(errorMessage(problem, t("tasksTaskApiTheTaskContextCouldNotBe"))));
  }, [t]);
  return <div className="page source-settings-page">
    <header className="page-header"><div><h1>{t("navIntakeSettings")}</h1><p className="muted">{t("intakeSettingsIntro")}</p></div></header>
    {error && <p className="status-message error-message" role="alert">{error}</p>}
    {sites.length > 1 && <section className="panel"><div className="field"><label htmlFor="source-settings-site">{t("site")}</label><select id="source-settings-site" value={siteId} onChange={event => setSiteId(event.target.value)}>{sites.map(site => <option value={site.siteId} key={site.siteId}>{site.name}</option>)}</select></div></section>}
    {siteId && <div className="source-settings-grid"><SourceList siteId={siteId} kind="source-type"/><SourceList siteId={siteId} kind="sender"/></div>}
  </div>;
}
