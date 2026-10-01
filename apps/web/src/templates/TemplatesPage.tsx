import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { Modal } from "../components/Modal";
import { RichTextContent, RichTextEditor } from "../components/RichText";
import { SectionHelp } from "../components/SectionHelp";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { TemplateLibrary } from "./TemplateLibrary";
import { defaultTemplateOwnerUnitId, emptyTemplateForm, type FinalReportTemplate, type TemplateForm, type TemplateSummary } from "./TemplateModels";
import { useTranslation } from "../localization/LocalizationProvider";

export function TemplatesPage() {
  const t = useTranslation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [sites, setSites] = useState<TaskSite[]>([]),
    [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [siteId, setSiteId] = useState("");
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm());
  const [finalReportTemplate, setFinalReportTemplate] = useState<FinalReportTemplate>({ content: "", canEdit: false });
  const [finalReportTemplateOpen, setFinalReportTemplateOpen] = useState(false);
  const [viewer, setViewer] = useState<TemplateSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", t("templateContextLoadFailed"))
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        const values = d.sites;
        setSites(values);
        setUnits(d.units);
        const firstSite = values[0];
        setSiteId(firstSite?.siteId ?? "");
        setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(firstSite, d.units)));
      }).catch((problem) => setError(problem instanceof Error ? problem.message : t("templateContextLoadFailed")));
  }, []);
  async function load() {
    if (!siteId) return;
    try {
      const [templatesResponse, finalReportResponse] = await Promise.all([
        apiGet<TemplateSummary[]>(`/api/templates/sites/${siteId}`, t("workTemplatesLoadFailed")),
        apiGet<{ content: string | null; canEdit: boolean }>(`/api/templates/sites/${siteId}/final-report`, t("finalReportTemplateLoadFailed")),
      ]);
      setTemplates(templatesResponse);
      setFinalReportTemplate({ content: finalReportResponse.content ?? "", canEdit: finalReportResponse.canEdit });
      setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("workTemplatesLoadFailed")); }
  }
  useEffect(() => {
    const selected = sites.find((site) => site.siteId === siteId);
    setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(selected, units)));
    void load();
  }, [siteId]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiMutate(
      form.id ? `/api/templates/${form.id}` : `/api/templates/sites/${siteId}`,
      form.id ? "PUT" : "POST",
      { name: form.name, content: form.content, ownerUnitId: form.ownerUnitId || null },
      t("workTemplateSaveConflict"));
      const selected = sites.find((site) => site.siteId === siteId);
      setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(selected, units)));
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("workTemplateSaveFailed")); }
  }
  async function remove(id: string) {
    try {
      await apiMutate(`/api/templates/${id}`, "DELETE", undefined, t("workTemplateDeleteFailed"));
      if (form.id === id) setForm(emptyTemplateForm());
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("workTemplateDeleteFailed")); }
  }
  async function saveFinalReportTemplate(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiMutate(`/api/templates/sites/${siteId}/final-report`, "PUT", { content: finalReportTemplate.content }, t("finalReportTemplateSaveFailed"));
      setFinalReportTemplateOpen(false);
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("finalReportTemplateSaveFailed")); }
  }
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t("workTemplates")}</h1>
          <p className="muted">{t("workTemplatesIntro")}</p>
        </div>
        <button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button>
      </header>
      {error && <p className="error-message">{error}</p>}
      {sites.length > 1 && <section className="panel personnel-site">
        <div className="field">
          <label>Site</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s.siteId} value={s.siteId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </section>}
      <section className="panel template-final-report-summary">
        <div className="admin-list-row">
          <span>
            <strong>{t("finalReportTemplate")}</strong>
            <small className="muted">{finalReportTemplate.content ? t("finalReportTemplateCreated") : t("notCreated")}</small>
          </span>
          <button className={finalReportTemplate.canEdit ? "primary-button" : "secondary-button"} type="button" onClick={() => setFinalReportTemplateOpen(true)}>
            {finalReportTemplate.canEdit ? (finalReportTemplate.content ? t("edit") : t("create")) : t("view")}
          </button>
        </div>
      </section>
      <div className="workflow-layout">
        <TemplateLibrary
          templates={templates}
          onView={setViewer}
          onEdit={template => setForm({ ...template, ownerUnitId: template.ownerUnitId ?? "" })}
          onRemove={template => { void remove(template.id); }}
        />
        {sites.find((site) => site.siteId === siteId)?.isSiteManager && <form className="panel stacked-form" onSubmit={save}>
          <h2>{form.id ? t("editTemplatePlain") : t("newTemplate")}</h2>
          <div className="field">
            <label>{t("scope")}</label>
            <select disabled={Boolean(form.id)} value={form.ownerUnitId} onChange={(e) => setForm({ ...form, ownerUnitId: e.target.value })}>
              <option value="">{t("sharedSitePlanning")}</option>
              {units.filter((unit) => unit.siteId === siteId && unit.isLeader).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t("name")}</label>
            <input
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t("startingContent")}</label>
            <RichTextEditor
              value={form.content}
              onChange={(content) => setForm({ ...form, content })}
            />
          </div>
          <p className="muted">{t("selectTemplateInWorkflows")}</p>
          <button className="primary-button">{t("saveWorkTemplate")}</button>
          {form.id && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(sites.find(site => site.siteId === siteId), units)))}
            >
              {t("cancelEditing")}
            </button>
          )}
        </form>}
      </div>
      {helpOpen && <SectionHelp title={t("workTemplateHelpTitle")} intro={t("workTemplateHelpIntro")} steps={[{title:t("workTemplateHelpTypeTitle"),text:t("workTemplateHelpTypeText")},{title:t("workTemplateHelpScopeTitle"),text:t("workTemplateHelpScopeText")},{title:t("workTemplateHelpContentTitle"),text:t("workTemplateHelpContentText")},{title:t("workTemplateHelpLinkTitle"),text:t("workTemplateHelpLinkText")},{title:t("workTemplateHelpManageTitle"),text:t("workTemplateHelpManageText")}]} note={t("workTemplateHelpNote")} onClose={() => setHelpOpen(false)} />}
      {viewer && (
        <Modal title={viewer.name} onClose={() => setViewer(null)}>
          <RichTextContent value={viewer.content} empty={t("emptyStartingContent")} />
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setViewer(null)}>{t("close")}</button>
            {viewer.canEdit && <button className="primary-button" type="button" onClick={() => { const selected=viewer; setViewer(null); setForm({ ...selected, ownerUnitId: selected.ownerUnitId ?? "" }); }}>{t("edit")}</button>}
          </div>
        </Modal>
      )}
      {finalReportTemplateOpen && (
        <Modal title={t("finalReportTemplate")} onClose={() => setFinalReportTemplateOpen(false)}>
          {finalReportTemplate.canEdit ? (
            <form className="stacked-form" onSubmit={saveFinalReportTemplate}>
              <p className="muted modal-note">{t("finalReportTemplateIntro")}</p>
              <div className="field">
                <label>{t("startingContent")}</label>
                <RichTextEditor value={finalReportTemplate.content} onChange={(content) => setFinalReportTemplate({ ...finalReportTemplate, content })} />
              </div>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setFinalReportTemplateOpen(false)}>{t("cancel")}</button>
                <button className="primary-button">{t("saveWorkTemplate")}</button>
              </div>
            </form>
          ) : (
            <div className="stacked-form">
              <RichTextContent value={finalReportTemplate.content} empty={t("noFinalReportTemplate")} />
              <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setFinalReportTemplateOpen(false)}>{t("close")}</button></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
