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
    apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", "The workflow context could not be loaded.")
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        setSites(d.sites);
        setUnits(d.units);
        const firstSite = d.sites[0];
        setSiteId(firstSite?.siteId ?? "");
        if (firstSite && !firstSite.isSiteManager) {
          setForm((current) => ({ ...current, kind: "execution", ownerUnitId: d.units.find((unit) => unit.siteId === firstSite.siteId && unit.isLeader)?.id ?? "" }));
        }
      }).catch(problem => setError(problem instanceof Error ? problem.message : "The workflow context could not be loaded."));
  }, []);
  async function load() {
    if (!siteId) return;
    try {
      const [workflowResponse, templateResponse] = await Promise.all([
        apiGet<WorkflowDefinitionSummary[]>(`/api/workflows/sites/${siteId}`, "Workflows could not be loaded."),
        apiGet<WorkflowTemplateSummary[]>(`/api/templates/sites/${siteId}`, "Templates could not be loaded."),
      ]);
      setFlows(workflowResponse); setTemplates(templateResponse); setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Workflows could not be loaded."); }
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
      "The workflow could not be saved.",
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
      setError(problem instanceof Error ? problem.message : "The workflow could not be created.");
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
      setError(problem instanceof Error ? problem.message : "The workflow could not be updated.");
    }
  }
  async function removeFlow(flow: WorkflowDefinitionSummary) {
    try { await apiMutate(`/api/workflows/sites/${siteId}/${flow.id}`, "DELETE", undefined, "The workflow could not be disabled."); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "The workflow could not be disabled."); return; }
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
            The Site Manager determines the content and order of the site's planning workflow
            and other processing workflows.
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
          <h2>Active arbeidsflyter</h2>
          <div className="admin-list">
            {flows.map((f) => (
              <div className="admin-list-row" key={f.id}>
                <span>
                  <strong>{f.name}</strong>
                  <small className="muted">
                    {f.kind === "planning"
                      ? "Planning"
                      : `Execution · ${f.ownerUnitName ?? "Entire site"}`}
                  </small>
                </span>
                <div className="row-actions">
                  <button className="link-button" type="button" onClick={() => setViewer(f)}>Vis</button>
                  {f.canEdit && <button className="link-button" type="button" onClick={() => edit(f)}>Edit</button>}
                  {f.canEdit && <button className="link-button danger" type="button" onClick={() => void removeFlow(f)}>Slett</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
        {selectedSite?.isSiteManager && <form className="panel stacked-form" onSubmit={create}>
          <h2>
            {form.kind === "planning" ? "Konfigurer planleggerflyt" : "New execution workflow"}
          </h2>
          {selectedSite.isSiteManager && (
            <>
              <div className="field">
                <label htmlFor="workflow-direction">Retning</label>
                <select id="workflow-direction" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "planning" | "execution", ownerUnitId: "", allocationStepName: "" })}>
                  <option value="planning">Planning</option>
                  <option value="execution">Execution</option>
                </select>
              </div>
              <p className="muted">The site has one active planning workflow but can have many execution workflows. Active processing retains the workflow version it started with.</p>
            </>
          )}
          {fields(form, setForm)}
          <button className="primary-button">
            {form.kind === "planning" ? "Activer planleggerflyt" : "Create execution workflow"}
          </button>
        </form>}
      </div>
      {helpOpen && <SectionHelp title="How to work with workflows" intro="Workflows determine which steps a task follows in planning or execution. They are configured before processing begins." steps={[{title:"Select direction and scope.",text:"Planning is a continuous, site-owned flow. Execution workflows can be shared across the site or linked to an internal level."},{title:"Create the steps in the correct order.",text:"Each step becomes a separate documentation section during processing. Names should describe what the user must do or deliver."},{title:"Link optional features.",text:"A step can receive initial content from a template, timeline, or task-allocation field when appropriate for the process."},{title:"Review and activate.",text:"Editing creates a new version, while active processing retains the version it started with."},{title:"Manage the site's workflows.",text:"The Site Manager creates, edits, and disables planning and execution workflows for the site."}]} note="Workflows are used in operational processing by relevant users, but are administered only by a Site Manager." onClose={() => setHelpOpen(false)} />}
      {editor && (
        <Modal title="Edit workflow" onClose={() => setEditor(null)}>
          <form className="stacked-form" onSubmit={update}>
            {fields(editor, (value) => setEditor({ ...editor, ...value }))}
            <p className="muted modal-note">
              Saving creates a new version. Active processing retains
              the previous version.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button className="primary-button">Save new version</button>
            </div>
          </form>
        </Modal>
      )}
      {viewer && (
        <Modal title={viewer.name} onClose={() => setViewer(null)}>
          <div className="stacked-form">
            <p className="muted">
              {viewer.kind === "planning"
                ? "Direction: Planning"
                : `Direction: Execution · Scope: ${viewer.ownerUnitName ?? "Entire site"}`}
            </p>
            <ol className="workflow-step-list">
              {viewer.steps.map((step, index) => (
                <li key={`${step.name}-${index}`}>
                  <strong>{step.name}</strong>
                  <span className="muted">
                    {[step.templateName ? `Mal: ${step.templateName}` : null, step.hasTimeline ? "Timeline" : null, step.allowsTaskAllocation ? "Task allocation" : null].filter(Boolean).join(" · ") || "No special step configuration"}
                  </span>
                </li>
              ))}
            </ol>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setViewer(null)}>Close</button>
              {viewer.canEdit && <button className="primary-button" type="button" onClick={() => { const selected=viewer; setViewer(null); edit(selected); }}>Edit</button>}
              {viewer.canEdit && <button className="danger-button" type="button" onClick={() => void removeFlow(viewer)}>Slett</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
