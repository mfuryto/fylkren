import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { Modal } from "../components/Modal";
import { SectionHelp } from "../components/SectionHelp";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { WorkflowFormFields } from "./WorkflowFormFields";
import { emptyWorkflowForm, type WorkflowDefinitionSummary, type WorkflowForm, type WorkflowTemplateSummary } from "./WorkflowModels";

export function WorkflowsPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const emptyForm = emptyWorkflowForm();
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [siteId, setSiteId] = useState("");
  const [flows, setFlows] = useState<WorkflowDefinitionSummary[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editor, setEditor] = useState<
    (typeof emptyForm & { id: string }) | null
  >(null);
  const [viewer, setViewer] = useState<WorkflowDefinitionSummary | null>(null);
  const [error, setError] = useState("");
  const selectedSite = sites.find((x) => x.siteId === siteId);
  useEffect(() => {
    apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", "Arbeidsflytkonteksten kunne ikke lastes.")
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        setSites(d.sites);
        setUnits(d.units);
        const firstSite = d.sites[0];
        setSiteId(firstSite?.siteId ?? "");
        if (firstSite && !firstSite.isSiteManager) {
          setForm((current) => ({ ...current, kind: "execution", ownerUnitId: d.units.find((unit) => unit.siteId === firstSite.siteId && unit.isLeader)?.id ?? "" }));
        }
      }).catch(problem => setError(problem instanceof Error ? problem.message : "Arbeidsflytkonteksten kunne ikke lastes."));
  }, []);
  async function load() {
    if (!siteId) return;
    try {
      const [workflowResponse, templateResponse] = await Promise.all([
        apiGet<WorkflowDefinitionSummary[]>(`/api/workflows/sites/${siteId}`, "Arbeidsflytene kunne ikke lastes."),
        apiGet<WorkflowTemplateSummary[]>(`/api/templates/sites/${siteId}`, "Malene kunne ikke lastes."),
      ]);
      setFlows(workflowResponse); setTemplates(templateResponse); setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Arbeidsflytene kunne ikke lastes."); }
  }
  useEffect(() => {
    void load();
  }, [siteId]);
  async function save(value: typeof form, id?: string) {
    const steps = value.steps
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        isOptional: false,
        allowsTaskAllocation: name === value.allocationStepName,
        hasTimeline: name === value.timelineStepName,
        templateId: value.templateIds[name] || null,
      }));
    await apiMutate(
      `/api/workflows/sites/${siteId}${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      {
          name: value.name,
          ownerUnitId: value.kind === "planning" ? null : value.ownerUnitId || null,
          kind: value.kind,
          steps,
      },
      "Arbeidsflyten kunne ikke lagres.",
    );
    await load();
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await save(form);
      setForm({
        ...emptyForm,
        ownerUnitId:
          selectedSite?.isSiteManager
            ? ""
            : (units.find((unit) => unit.siteId === siteId && unit.isLeader)?.id ?? ""),
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Arbeidsflyten kunne ikke opprettes.");
    }
  }
  async function update(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    setError("");
    try {
      await save(editor, editor.id);
      setEditor(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Arbeidsflyten kunne ikke oppdateres.");
    }
  }
  async function removeFlow(flow: WorkflowDefinitionSummary) {
    try { await apiMutate(`/api/workflows/sites/${siteId}/${flow.id}`, "DELETE", undefined, "Arbeidsflyten kunne ikke deaktiveres."); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Arbeidsflyten kunne ikke deaktiveres."); return; }
    if (viewer?.id === flow.id) setViewer(null);
    await load();
  }
  function edit(flow: WorkflowDefinitionSummary) {
    setEditor({
      id: flow.id,
      name: flow.name,
      ownerUnitId: flow.ownerUnitId ?? "",
      kind: flow.kind as "planning" | "execution",
      steps: flow.steps.map((x) => x.name).join("\n"),
      allocationStepName:
        flow.steps.find((x) => x.allowsTaskAllocation)?.name ?? "",
      timelineStepName: flow.steps.find((x) => x.hasTimeline)?.name ?? "",
      templateIds: Object.fromEntries(
        flow.steps
          .filter((x) => x.templateId)
          .map((x) => [x.name, x.templateId!]),
      ),
    });
  }
  const fields = (value: WorkflowForm, setValue: (value: WorkflowForm) => void) => (
    <WorkflowFormFields
      value={value}
      onChange={setValue}
      selectedSite={selectedSite}
      siteId={siteId}
      units={units}
      templates={templates}
    />
  );
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Arbeidsflyter</h1>
          <p className="muted">
            Site Manager bestemmer innhold og rekkefølge i sitens planleggerflyt
            og øvrige behandlingsprosesser.
          </p>
        </div>
        <button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button>
      </header>
      {error && <p className="status-message error-message">{error}</p>}
      {sites.length > 1 && <section className="panel personnel-site">
        <div className="field">
          <label>Site</label>
          <select value={siteId} onChange={(e) => {
            const nextSiteId = e.target.value;
            const nextSite = sites.find((site) => site.siteId === nextSiteId);
            setSiteId(nextSiteId);
            setForm({ ...emptyForm, ownerUnitId: nextSite?.isSiteManager ? "" : (units.find((unit) => unit.siteId === nextSiteId && unit.isLeader)?.id ?? "") });
          }}>
            {sites.map((x) => (
              <option key={x.siteId} value={x.siteId}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      </section>}
      <div className="workflow-layout">
        <section className="panel">
          <h2>Aktive arbeidsflyter</h2>
          <div className="admin-list">
            {flows.map((f) => (
              <div className="admin-list-row" key={f.id}>
                <span>
                  <strong>{f.name}</strong>
                  <small className="muted">
                    {f.kind === "planning"
                      ? "Planlegging"
                      : `Utførelse · ${f.ownerUnitName ?? "Hele siten"}`}
                  </small>
                </span>
                <div className="row-actions">
                  <button className="link-button" type="button" onClick={() => setViewer(f)}>Vis</button>
                  {f.canEdit && <button className="link-button" type="button" onClick={() => edit(f)}>Rediger</button>}
                  {f.canEdit && <button className="link-button danger" type="button" onClick={() => void removeFlow(f)}>Slett</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
        {selectedSite?.isSiteManager && <form className="panel stacked-form" onSubmit={create}>
          <h2>
            {form.kind === "planning" ? "Konfigurer planleggerflyt" : "Ny utførelsesflyt"}
          </h2>
          {selectedSite.isSiteManager && (
            <>
              <div className="field">
                <label htmlFor="workflow-direction">Retning</label>
                <select id="workflow-direction" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "planning" | "execution", ownerUnitId: "", allocationStepName: "" })}>
                  <option value="planning">Planlegging</option>
                  <option value="execution">Utførelse</option>
                </select>
              </div>
              <p className="muted">Siten har én aktiv planleggerflyt, men kan ha mange utførelsesflyter. Pågående behandlinger beholder arbeidsflytversjonen de startet med.</p>
            </>
          )}
          {fields(form, setForm)}
          <button className="primary-button">
            {form.kind === "planning" ? "Aktiver planleggerflyt" : "Opprett utførelsesflyt"}
          </button>
        </form>}
      </div>
      {helpOpen && <SectionHelp title="Slik arbeider du med arbeidsflyter" intro="Arbeidsflyter bestemmer hvilke steg et oppdrag følger i planlegging eller utførelse. De konfigureres før behandlingen starter." steps={[{title:"Velg retning og omfang.",text:"Planlegging er en gjennomgående, site-eid flyt. Utførelsesflyter kan være felles for siten eller knyttes til et internt nivå."},{title:"Opprett stegene i riktig rekkefølge.",text:"Hvert steg blir en egen dokumentasjonsdel under behandlingen. Navnene skal beskrive hva brukeren skal gjøre eller levere."},{title:"Knytt til valgfrie funksjoner.",text:"Et steg kan få startinnhold fra en mal, tidslinje eller felt for oppgavefordeling når dette passer prosessen."},{title:"Kontroller og aktiver.",text:"Ved redigering opprettes en ny versjon, mens pågående behandlinger beholder versjonen de startet med."},{title:"Forvalt sitens flyter.",text:"Site Manager oppretter, redigerer og deaktiverer planleggings- og utførelsesflyter for siten."}]} note="Arbeidsflytene brukes i operativ behandling av relevante brukere, men administreres bare av Site Manager." onClose={() => setHelpOpen(false)} />}
      {editor && (
        <Modal title="Rediger arbeidsflyt" onClose={() => setEditor(null)}>
          <form className="stacked-form" onSubmit={update}>
            {fields(editor, (value) => setEditor({ ...editor, ...value }))}
            <p className="muted modal-note">
              Lagring oppretter en ny versjon. Pågående behandlinger beholder
              den tidligere versjonen.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setEditor(null)}
              >
                Avbryt
              </button>
              <button className="primary-button">Lagre ny versjon</button>
            </div>
          </form>
        </Modal>
      )}
      {viewer && (
        <Modal title={viewer.name} onClose={() => setViewer(null)}>
          <div className="stacked-form">
            <p className="muted">
              {viewer.kind === "planning"
                ? "Retning: Planlegging"
                : `Retning: Utførelse · Omfang: ${viewer.ownerUnitName ?? "Hele siten"}`}
            </p>
            <ol className="workflow-step-list">
              {viewer.steps.map((step, index) => (
                <li key={`${step.name}-${index}`}>
                  <strong>{step.name}</strong>
                  <span className="muted">
                    {[step.templateName ? `Mal: ${step.templateName}` : null, step.hasTimeline ? "Tidslinjal" : null, step.allowsTaskAllocation ? "Oppgavefordeling" : null].filter(Boolean).join(" · ") || "Ingen særskilt stegkonfigurasjon"}
                  </span>
                </li>
              ))}
            </ol>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setViewer(null)}>Lukk</button>
              {viewer.canEdit && <button className="primary-button" type="button" onClick={() => { const selected=viewer; setViewer(null); edit(selected); }}>Rediger</button>}
              {viewer.canEdit && <button className="danger-button" type="button" onClick={() => void removeFlow(viewer)}>Slett</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
