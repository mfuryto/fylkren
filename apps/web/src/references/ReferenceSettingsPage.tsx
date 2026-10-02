import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { useTranslation } from "../localization/LocalizationProvider";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";
import { Modal } from "../components/Modal";
import type { WorkItemType } from "../work/WorkItemModels";

type SiteReference = {
  siteId: string;
  name: string;
  isActive?: boolean;
  prefix: string;
  updatedAt: string;
  types?: Array<{ name: string; abbreviation: string; isActive: boolean }>;
};

type ReferenceSettings = {
  minimumDigits: number;
  nextNumber: number;
  preview?: string;
  updatedAt?: string;
  sites: SiteReference[];
};

type SavedSiteReference = SiteReference & { preview: string };

function preview(prefix: string, nextNumber: number, minimumDigits: number) {
  return `${prefix}-${String(nextNumber).padStart(minimumDigits, "0")}`;
}

type TypeDraft = { id: string; name: string; abbreviation: string; isActive: boolean };
const emptyTypeDraft = (): TypeDraft => ({ id: "", name: "", abbreviation: "", isActive: true });
const suggestedAbbreviation = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^[^A-Z]+/, "").slice(0, 3);

function TaskTypeReferenceSettings({ siteId }: { siteId: string }) {
  const t = useTranslation();
  const [types, setTypes] = useState<WorkItemType[]>([]);
  const [draft, setDraft] = useState<TypeDraft>(emptyTypeDraft);
  const [abbreviationEdited, setAbbreviationEdited] = useState(false);
  const [sort, setSort] = useState<ListSort>("newest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setTypes(await apiGet<WorkItemType[]>(`/api/work/sites/${siteId}/types`, t("tasksTaskApiTaskTypesCouldNotBeLoaded")));
      setError("");
    } catch (problem) { setError(errorMessage(problem, t("tasksTaskApiTaskTypesCouldNotBeLoaded"))); }
  };
  useEffect(() => { setDraft(emptyTypeDraft()); setAbbreviationEdited(false); void load(); }, [siteId]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await apiMutate(`/api/work/sites/${siteId}/types${draft.id ? `/${draft.id}` : ""}`, draft.id ? "PUT" : "POST", draft, t("tasksTasksPageTheTaskTypeCouldNotBe"));
      setDraft(emptyTypeDraft()); setAbbreviationEdited(false); await load();
    } catch (problem) { setError(errorMessage(problem, t("tasksTasksPageTheTaskTypeCouldNotBe"))); }
    finally { setBusy(false); }
  };
  const beginEdit = (value: WorkItemType) => {
    setDraft({ id: value.id, name: value.name, abbreviation: value.abbreviation ?? "", isActive: value.isActive });
    setAbbreviationEdited(true);
  };
  const sorted = sortList(types, sort, { name: value => value.name, reference: value => value.abbreviation ?? "" });
  return <section className="reference-task-types">
    <div className="section-heading"><h3>{t("tasksTaskLookupDialogsTaskTypes")}</h3><ListSortControl id={`reference-type-sort-${siteId}`} value={sort} onChange={setSort} options={["newest", "oldest", "name-asc", "name-desc", "reference-asc", "reference-desc"]}/></div>
    {error && <p className="status-message error-message" role="alert">{error}</p>}
    <form className="reference-type-form" onSubmit={save}>
      <div className="field"><label htmlFor="reference-type-name">{t("name")}</label><input id="reference-type-name" required minLength={2} maxLength={100} value={draft.name} onChange={event => { const name = event.target.value; setDraft(current => ({ ...current, name, abbreviation: abbreviationEdited ? current.abbreviation : suggestedAbbreviation(name) })); }}/></div>
      <div className="field"><label htmlFor="reference-type-abbreviation">{t("abbreviation")}</label><input id="reference-type-abbreviation" required minLength={2} maxLength={12} pattern="[A-Za-z][A-Za-z0-9]*" value={draft.abbreviation} onChange={event => { setAbbreviationEdited(true); setDraft(current => ({ ...current, abbreviation: event.target.value.toUpperCase() })); }}/></div>
      {draft.id && <label className="checkbox-field"><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })}/> {t("tasksTaskLookupDialogsActiveTaskType")}</label>}
      <div className="inline-actions"><button className="primary-button" disabled={busy}>{draft.id ? t("tasksTaskLookupDialogsSaveType") : t("createType")}</button>{draft.id && <button className="secondary-button" type="button" onClick={() => { setDraft(emptyTypeDraft()); setAbbreviationEdited(false); }}>{t("cancelEditing")}</button>}</div>
    </form>
    <div className="reference-type-table" role="table">
      <div className="reference-type-row reference-type-header" role="row"><span role="columnheader">{t("name")}</span><span role="columnheader">{t("abbreviation")}</span><span role="columnheader">{t("active")}</span><span aria-hidden="true"/></div>
      {sorted.map(value => <div className="reference-type-row" role="row" key={value.id}><strong role="cell">{value.name}</strong><code role="cell">{value.abbreviation}</code><span role="cell">{value.isActive ? t("active") : t("inactive")}</span><span role="cell">{value.isSystemManaged ? <small className="muted">{t("tasksTaskLookupDialogsSystemManaged")}</small> : <button className="link-button" type="button" onClick={() => beginEdit(value)}>{t("edit")}</button>}</span></div>)}
    </div>
  </section>;
}

export function ReferenceSettingsPage({ isPlatformManager }: { isPlatformManager: boolean }) {
  const t = useTranslation();
  const [settings, setSettings] = useState<ReferenceSettings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sort, setSort] = useState<ListSort>("name-asc");
  const [typeSiteId, setTypeSiteId] = useState("");
  const endpoint = isPlatformManager ? "/api/references/platform" : "/api/references/sites";

  useEffect(() => {
    setError("");
    apiGet<ReferenceSettings>(endpoint, t(isPlatformManager ? "platformReferenceLoadFailed" : "siteReferencesLoadFailed"))
      .then(setSettings)
      .catch(problem => setError(errorMessage(problem, t(isPlatformManager ? "platformReferenceLoadFailed" : "siteReferencesLoadFailed"))));
  }, [endpoint, isPlatformManager, t]);
  useEffect(() => {
    if (!settings?.sites.length) { setTypeSiteId(""); return; }
    setTypeSiteId(current => settings.sites.some(site => site.siteId === current) ? current : settings.sites[0].siteId);
  }, [settings?.sites]);

  const platformPreview = useMemo(() => settings
    ? preview("TYPE", settings.nextNumber, settings.minimumDigits)
    : "", [settings]);

  const savePlatform = async () => {
    if (!settings) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await apiMutate<Omit<ReferenceSettings, "sites">>("/api/references/platform", "PUT", {
        minimumDigits: settings.minimumDigits,
        nextNumber: settings.nextNumber,
      }, t("platformReferenceSaveFailed"));
      setSettings({ ...settings, ...result });
      setMessage(t("platformReferenceSaved"));
    } catch (problem) {
      setError(errorMessage(problem, t("platformReferenceSaveFailed")));
    } finally { setBusy(false); }
  };

  const updateSite = (siteId: string, change: Partial<Pick<SiteReference, "prefix">>) =>
    setSettings(current => current ? {
      ...current,
      sites: current.sites.map(site => site.siteId === siteId ? { ...site, ...change } : site),
    } : current);

  const saveSite = async (site: SiteReference) => {
    if (!settings) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const saved = await apiMutate<SavedSiteReference>(`/api/references/sites/${site.siteId}`, "PUT", {
        prefix: site.prefix,
      }, t("siteReferenceSaveFailed"));
      setSettings({ ...settings, sites: settings.sites.map(value => value.siteId === site.siteId ? { ...value, ...saved } : value) });
      setMessage(t("siteReferenceSaved"));
    } catch (problem) {
      setError(errorMessage(problem, t("siteReferenceSaveFailed")));
    } finally { setBusy(false); }
  };

  return <div className="page platform-admin-page reference-settings-page">
    <header className="page-header"><div><h1>{t("referencesTitle")}</h1><p className="muted">{t("referencesIntro")}</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>
    {error && <p className="status-message error-message">{error}</p>}
    {message && <p className="status-message success-message">{message}</p>}
    {settings && <>
      {isPlatformManager && <section className="panel">
        <div className="section-heading"><div><h2>{t("platformReferenceTitle")}</h2><p className="muted">{t("platformReferenceIntro")}</p></div></div>
        <div className="reference-settings-grid">
          <div className="field"><label htmlFor="reference-minimum-digits">{t("minimumDigits")}</label><input id="reference-minimum-digits" type="number" min={3} max={10} value={settings.minimumDigits} onChange={event => setSettings({ ...settings, minimumDigits: Number(event.target.value) })}/></div>
          <div className="field"><label htmlFor="reference-next-number">{t("nextNumber")}</label><input id="reference-next-number" type="number" min={1} value={settings.nextNumber} onChange={event => setSettings({ ...settings, nextNumber: Number(event.target.value) })}/></div>
          <div className="reference-preview"><small>{t("referencePreview")}</small><strong>{platformPreview}</strong></div>
        </div>
        <div className="inline-actions"><button className="primary-button" type="button" disabled={busy} onClick={() => void savePlatform()}>{t("savePlatformReference")}</button></div>
      </section>}
      <section className="panel">
        <div className="section-heading"><div><h2>{t("siteReferenceTitle")}</h2><p className="muted">{t("siteReferenceIntro")}</p></div><ListSortControl id="site-reference-sort" value={sort} onChange={setSort} options={["name-asc", "name-desc", "reference-asc", "reference-desc"]}/></div>
        <div className="reference-site-list">{sortList(settings.sites, sort, { name: site => site.name, reference: site => site.prefix }).map(site => <article className="reference-site-card" key={site.siteId}>
          <div className="reference-site-heading"><div><h3>{site.name}</h3>{site.isActive === false && <span className="status-badge inactive">{t("inactive")}</span>}</div><code>{preview(site.prefix, settings.nextNumber, settings.minimumDigits)}</code></div>
          <div className="reference-settings-grid">
            <div className="field"><label htmlFor={`reference-prefix-${site.siteId}`}>{t("siteCode")}</label><input id={`reference-prefix-${site.siteId}`} required minLength={2} maxLength={12} pattern="[A-Za-z][A-Za-z0-9]*" disabled={isPlatformManager || busy} value={site.prefix} onChange={event => updateSite(site.siteId, { prefix: event.target.value.toUpperCase() })}/></div>
            {!isPlatformManager && <div className="inline-actions reference-site-action"><button className="secondary-button" type="button" disabled={busy} onClick={() => void saveSite(site)}>{t("saveSiteReference")}</button></div>}
          </div>
          {isPlatformManager && site.types && site.types.length > 0 && <div className="reference-type-summary">{site.types.map(type => <span className="status-badge" key={`${type.name}-${type.abbreviation}`}>{type.abbreviation} · {type.name}{type.isActive ? "" : ` · ${t("inactive")}`}</span>)}</div>}
        </article>)}</div>
        <p className="muted reference-history-note">{t("referenceHistoryNote")}</p>
      </section>
      {!isPlatformManager && settings.sites.length > 0 && <section className="panel">
        <div className="section-heading"><div><h2>{t("tasksTaskLookupDialogsTaskTypes")}</h2><p className="muted">{t("siteReferenceIntro")}</p></div></div>
        {settings.sites.length > 1 && <div className="field"><label htmlFor="reference-type-site">{t("site")}</label><select id="reference-type-site" value={typeSiteId} onChange={event => setTypeSiteId(event.target.value)}>{settings.sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></div>}
        {typeSiteId && <TaskTypeReferenceSettings siteId={typeSiteId}/>} 
      </section>}
    </>}
    {helpOpen && <Modal title={t("referencesTitle")} onClose={() => setHelpOpen(false)}><div className="process-help"><p>{t("referencesIntro")}</p><p>{t(isPlatformManager ? "platformReferenceIntro" : "siteReferenceIntro")}</p><p>{t("referenceHistoryNote")}</p></div><div className="modal-actions"><button className="primary-button" type="button" onClick={() => setHelpOpen(false)}>{t("close")}</button></div></Modal>}
  </div>;
}
