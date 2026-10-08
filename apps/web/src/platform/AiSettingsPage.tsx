import { useEffect, useState } from "react";
import type React from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { useTranslation } from "../localization/LocalizationProvider";
import { loadSites } from "../siteAdmin/siteAdminApi";
import type { SiteSummary } from "../siteAdmin/models";

type AiSettings = {
  enabled: boolean; endpointUrl: string; model: string; hasApiKey: boolean;
  summaryEnabled: boolean; draftsEnabled: boolean; learningEnabled: boolean; questionsEnabled: boolean;
  lastTestedAt: string | null; lastTestSucceeded: boolean | null; lastTestError: string | null; siteIds: string[];
};

export function AiSettingsPage({ canManage }: { canManage: boolean }) {
  const t = useTranslation();
  const [settings, setSettings] = useState<AiSettings | null>(null), [sites, setSites] = useState<SiteSummary[]>([]);
  const [apiKey, setApiKey] = useState(""), [clearApiKey, setClearApiKey] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function load() {
    const [value, allSites] = await Promise.all([apiGet<AiSettings>("/api/platform/ai", t("aiLoadFailed")), loadSites()]);
    setSettings(value); setSites(allSites.filter(site => site.isActive));
  }
  useEffect(() => { void load().catch(problem => setMessage(errorMessage(problem, t("aiLoadFailed")))); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!settings) return; setBusy(true); setMessage("");
    try {
      const saved = await apiMutate<AiSettings>("/api/platform/ai", "PUT", { ...settings, apiKey: apiKey || null, clearApiKey }, t("aiSaveFailed"));
      setSettings(saved); setApiKey(""); setClearApiKey(false); setMessage(t("aiSaved"));
    } catch (problem) { setMessage(errorMessage(problem, t("aiSaveFailed"))); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMessage("");
    try {
      const result = await apiMutate<{ lastTestSucceeded: boolean; lastTestError: string | null }>("/api/platform/ai/test", "POST", undefined, t("aiTestFailed"));
      setMessage(result.lastTestSucceeded ? t("aiTestSucceeded") : `${t("aiTestFailed")} ${result.lastTestError ?? ""}`.trim()); await load();
    } catch (problem) { setMessage(errorMessage(problem, t("aiTestFailed"))); } finally { setBusy(false); }
  }
  const change = (value: Partial<AiSettings>) => setSettings(current => current ? { ...current, ...value } : current);
  const toggleSite = (id: string, checked: boolean) => change({ siteIds: checked ? [...(settings?.siteIds ?? []), id] : (settings?.siteIds ?? []).filter(value => value !== id) });
  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>AI</h1><p className="muted">{t("aiPageIntro")}</p></div></header>
    {!canManage && <EnterpriseRequiredNotice>{t("aiEnterpriseNotice")}</EnterpriseRequiredNotice>}
    {message && <p className="status-message" role="status">{message}</p>}
    {settings && <form className="panel stacked-form" onSubmit={save}>
      <label className="checkbox-row ai-master-toggle"><input type="checkbox" checked={settings.enabled} disabled={!canManage} onChange={event => change({ enabled: event.target.checked })}/><span><strong>{t("aiMasterSwitch")}</strong><small>{t("aiMasterHelp")}</small></span></label>
      <section className="site-detail-block"><h2>{t("aiProvider")}</h2><p className="muted">{t("aiProviderHelp")}</p>
        <div className="field"><label htmlFor="ai-endpoint">{t("aiEndpoint")}</label><input id="ai-endpoint" type="url" required maxLength={2000} disabled={!canManage} value={settings.endpointUrl} onChange={event => change({ endpointUrl: event.target.value })}/><small>{t("aiEndpointHelp")}</small></div>
        <div className="field"><label htmlFor="ai-model">{t("aiModel")}</label><input id="ai-model" required maxLength={200} disabled={!canManage} value={settings.model} onChange={event => change({ model: event.target.value })}/></div>
        <div className="field"><label htmlFor="ai-key">{t("aiApiKey")}</label><input id="ai-key" type="password" maxLength={4000} autoComplete="new-password" disabled={!canManage || clearApiKey} value={apiKey} onChange={event => setApiKey(event.target.value)} />{settings.hasApiKey && <small>{t("aiStoredSecret")}</small>}</div>
        {settings.hasApiKey && <label className="checkbox-row"><input type="checkbox" disabled={!canManage} checked={clearApiKey} onChange={event => setClearApiKey(event.target.checked)}/><span>{t("aiRemoveKey")}</span></label>}
      </section>
      <section className="site-detail-block"><h2>{t("aiFunctions")}</h2>
        {([ ["summaryEnabled", "aiSummaryFunction"], ["draftsEnabled", "aiDraftsFunction"], ["learningEnabled", "aiLearningFunction"], ["questionsEnabled", "aiQuestionsFunction"] ] as const).map(([key, label]) => <label className="checkbox-row" key={key}><input type="checkbox" disabled={!canManage} checked={settings[key]} onChange={event => change({ [key]: event.target.checked })}/><span>{t(label)}</span></label>)}
      </section>
      <section className="site-detail-block"><h2>{t("aiSites")}</h2><p className="muted">{t("aiSitesHelp")}</p>
        <div className="api-scope-list">{sites.map(site => <label className="checkbox-row" key={site.id}><input type="checkbox" disabled={!canManage} checked={settings.siteIds.includes(site.id)} onChange={event => toggleSite(site.id, event.target.checked)}/><span>{site.name}</span></label>)}</div>
      </section>
      <div className="inline-actions"><button className="primary-button" disabled={!canManage || busy}>{t("aiSave")}</button><button className="secondary-button" type="button" disabled={!canManage || busy || !settings.model} onClick={() => void test()}>{t("aiTest")}</button></div>
    </form>}
  </div>;
}
