import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { Modal } from "../components/Modal";
import { RichTextContent, RichTextEditor } from "../components/RichText";
import { SectionHelp } from "../components/SectionHelp";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { TemplateLibrary } from "./TemplateLibrary";
import { defaultTemplateOwnerUnitId, emptyTemplateForm, type FinalReportTemplate, type TemplateForm, type TemplateSummary } from "./TemplateModels";

export function TemplatesPage() {
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
    apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", "Malkonteksten kunne ikke lastes.")
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        const values = d.sites;
        setSites(values);
        setUnits(d.units);
        const firstSite = values[0];
        setSiteId(firstSite?.siteId ?? "");
        setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(firstSite, d.units)));
      }).catch((problem) => setError(problem instanceof Error ? problem.message : "Malkonteksten kunne ikke lastes."));
  }, []);
  async function load() {
    if (!siteId) return;
    try {
      const [templatesResponse, finalReportResponse] = await Promise.all([
        apiGet<TemplateSummary[]>(`/api/templates/sites/${siteId}`, "Malene kunne ikke lastes."),
        apiGet<{ content: string | null; canEdit: boolean }>(`/api/templates/sites/${siteId}/final-report`, "Sluttrapportmalen kunne ikke lastes."),
      ]);
      setTemplates(templatesResponse);
      setFinalReportTemplate({ content: finalReportResponse.content ?? "", canEdit: finalReportResponse.canEdit });
      setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Malene kunne ikke lastes."); }
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
      "Malen kunne ikke lagres. Kontroller at navnet er unikt.");
      const selected = sites.find((site) => site.siteId === siteId);
      setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(selected, units)));
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Malen kunne ikke lagres."); }
  }
  async function remove(id: string) {
    try {
      await apiMutate(`/api/templates/${id}`, "DELETE", undefined, "Malen kunne ikke slettes.");
      if (form.id === id) setForm(emptyTemplateForm());
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Malen kunne ikke slettes."); }
  }
  async function saveFinalReportTemplate(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiMutate(`/api/templates/sites/${siteId}/final-report`, "PUT", { content: finalReportTemplate.content }, "Sluttrapportmalen kunne ikke lagres.");
      setFinalReportTemplateOpen(false);
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Sluttrapportmalen kunne ikke lagres."); }
  }
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Maler</h1>
          <p className="muted">
            Forvalt sitens gjenbrukbare startinnhold. Malen knyttes til et steg
            når arbeidsflyten konfigureres.
          </p>
        </div>
        <button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button>
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
            <strong>Sluttrapportmal</strong>
            <small className="muted">{finalReportTemplate.content ? "Opprettet · felles for hele siten" : "Ikke opprettet"}</small>
          </span>
          <button className={finalReportTemplate.canEdit ? "primary-button" : "secondary-button"} type="button" onClick={() => setFinalReportTemplateOpen(true)}>
            {finalReportTemplate.canEdit ? (finalReportTemplate.content ? "Rediger" : "Opprett") : "Vis"}
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
          <h2>{form.id ? "Rediger mal" : "Ny mal"}</h2>
          <div className="field">
            <label>Omfang</label>
            <select disabled={Boolean(form.id)} value={form.ownerUnitId} onChange={(e) => setForm({ ...form, ownerUnitId: e.target.value })}>
              <option value="">Felles for siten og planlegging</option>
              {units.filter((unit) => unit.siteId === siteId && unit.isLeader).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Navn</label>
            <input
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Startinnhold</label>
            <RichTextEditor
              value={form.content}
              onChange={(content) => setForm({ ...form, content })}
            />
          </div>
          <p className="muted">
            Velg malen for ønsket steg på siden Arbeidsflyter.
          </p>
          <button className="primary-button">Lagre mal</button>
          {form.id && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setForm(emptyTemplateForm(defaultTemplateOwnerUnitId(sites.find(site => site.siteId === siteId), units)))}
            >
              Avbryt redigering
            </button>
          )}
        </form>}
      </div>
      {helpOpen && <SectionHelp title="Slik arbeider du med maler" intro="Maler gir gjenbrukbart startinnhold til arbeidsflytsteg og sluttrapporter. De endrer ikke innhold som allerede er tatt i bruk." steps={[{title:"Velg riktig maltype.",text:"Vanlige maler brukes som startinnhold i valgte arbeidsflytsteg. Sluttrapportmalen er én egen, site-felles mal for alle nivåer."},{title:"Velg omfang.",text:"En mal kan være felles for siten og planleggingen eller eies av et internt nivå for lokale utførelsesflyter."},{title:"Skriv startinnholdet.",text:"Bruk overskrifter, lister og vanlig tekst for å gi en ryddig struktur som brukeren kan fylle ut videre."},{title:"Knytt malen til arbeidsflyten.",text:"Koblingen gjøres i konfigurasjonen av det aktuelle arbeidsflytsteget, ikke mens oppdraget behandles."},{title:"Forvalt lokalt innhold.",text:"Sjef og bemyndiget leder kan opprette og redigere maler som eies av deres nivå. Site Manager forvalter site-felles maler og sluttrapportmalen."}]} note="Alle nivåer kan se malene i siten. Bare eiernivået kan endre eller slette dem." onClose={() => setHelpOpen(false)} />}
      {viewer && (
        <Modal title={viewer.name} onClose={() => setViewer(null)}>
          <RichTextContent value={viewer.content} empty="Tomt startinnhold" />
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setViewer(null)}>Lukk</button>
            {viewer.canEdit && <button className="primary-button" type="button" onClick={() => { const selected=viewer; setViewer(null); setForm({ ...selected, ownerUnitId: selected.ownerUnitId ?? "" }); }}>Rediger</button>}
          </div>
        </Modal>
      )}
      {finalReportTemplateOpen && (
        <Modal title="Sluttrapportmal" onClose={() => setFinalReportTemplateOpen(false)}>
          {finalReportTemplate.canEdit ? (
            <form className="stacked-form" onSubmit={saveFinalReportTemplate}>
              <p className="muted modal-note">Malen brukes som startinnhold i nye sluttrapporter på alle nivåer i siten.</p>
              <div className="field">
                <label>Startinnhold</label>
                <RichTextEditor value={finalReportTemplate.content} onChange={(content) => setFinalReportTemplate({ ...finalReportTemplate, content })} />
              </div>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setFinalReportTemplateOpen(false)}>Avbryt</button>
                <button className="primary-button">Lagre mal</button>
              </div>
            </form>
          ) : (
            <div className="stacked-form">
              <RichTextContent value={finalReportTemplate.content} empty="Ingen sluttrapportmal er opprettet." />
              <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setFinalReportTemplateOpen(false)}>Lukk</button></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
