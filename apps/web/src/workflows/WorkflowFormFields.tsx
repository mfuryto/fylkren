import { translateActive } from "../localization";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { WorkflowForm, WorkflowTemplateSummary } from "./WorkflowModels";

type WorkflowFormFieldsProps = {
  value: WorkflowForm;
  onChange: (value: WorkflowForm) => void;
  selectedSite?: TaskSite;
  siteId: string;
  units: TaskUnit[];
  templates: WorkflowTemplateSummary[];
};

export function workflowStepNames(steps: string) {
  return steps.split("\n").map(value => value.trim()).filter(Boolean);
}

export function isWorkflowTemplateApplicable(template: WorkflowTemplateSummary, form: WorkflowForm, units: TaskUnit[]) {
  if (template.ownerUnitId === null) return true;
  if (form.kind === "planning" || !form.ownerUnitId) return false;
  const visited = new Set<string>();
  let current: string | null = form.ownerUnitId;
  while (current && !visited.has(current)) {
    if (current === template.ownerUnitId) return true;
    visited.add(current);
    current = units.find(unit => unit.id === current)?.parentId ?? null;
  }
  return false;
}

export function WorkflowFormFields({ value, onChange, selectedSite, siteId, units, templates }: WorkflowFormFieldsProps) {
  const canAdministerSite = Boolean(selectedSite?.isSiteManager);
  const selectableUnits = units.filter(unit => unit.siteId === siteId && unit.isLeader);
  const stepNames = workflowStepNames(value.steps);
  const applicableTemplates = templates.filter(template => isWorkflowTemplateApplicable(template, value, units));

  return <>
    <div className="field">
      <label>{translateActive("name")}</label>
      <input required minLength={2} maxLength={200} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })}/>
    </div>
    {value.kind === "execution" && <div className="field">
      <label>{translateActive("scope")}</label>
      <select value={value.ownerUnitId} onChange={event => onChange({ ...value, ownerUnitId: event.target.value })}>
        {canAdministerSite && <option value="">{translateActive("entireSite")}</option>}
        {!canAdministerSite && <option value="">{translateActive("workflowsWorkflowFormFieldsSelectOwnLevel")}</option>}
        {selectableUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select>
    </div>}
    <div className="field">
      <label>{translateActive("workflowsWorkflowFormFieldsStepsOnePerLineInThe")}</label>
      <textarea required rows={8} value={value.steps} onChange={event => {
        const steps = event.target.value;
        const names = workflowStepNames(steps);
        onChange({
          ...value,
          steps,
          allocationStepName: names.includes(value.allocationStepName) ? value.allocationStepName : "",
          timelineStepName: names.includes(value.timelineStepName) ? value.timelineStepName : "",
        });
      }}/>
    </div>
    {stepNames.length > 0 && <section className="workflow-template-assignment">
      <h3>{translateActive("workflowsWorkflowFormFieldsInitialContentForSteps")}</h3>
      <p className="muted">{translateActive("workflowsWorkflowFormFieldsOptionallySelectOneTemplatePerStep")}</p>
      {stepNames.map((name, index) => <div className="field" key={`${name}-${index}`}>
        <label>{name}</label>
        <select value={value.templateIds[name] ?? ""} onChange={event => onChange({ ...value, templateIds: { ...value.templateIds, [name]: event.target.value } })}>
          <option value="">{translateActive("workflowsWorkflowFormFieldsNoTemplate")}</option>
          {applicableTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </div>)}
    </section>}
    <div className="field">
      <label>{translateActive("workflowsWorkflowFormFieldsStepWithTimeline")}</label>
      <select value={value.timelineStepName} onChange={event => onChange({ ...value, timelineStepName: event.target.value })}>
        <option value="">{translateActive("workflowsWorkflowFormFieldsNoTimeline")}</option>
        {stepNames.map((name, index) => <option key={`${name}-timeline-${index}`} value={name}>{name}</option>)}
      </select>
      <small className="muted">{translateActive("workflowsWorkflowFormFieldsTheTimelineAppearsBeforeTheStep")}</small>
    </div>
    {value.kind === "planning" && <div className="field">
      <label>{translateActive("workflowsWorkflowFormFieldsTaskAllocationStep")}</label>
      <select required value={value.allocationStepName} onChange={event => onChange({ ...value, allocationStepName: event.target.value })}>
        <option value="">{translateActive("workflowsWorkflowFormFieldsSelectWhereAddTaskAllocationShould")}</option>
        {stepNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
      </select>
    </div>}
  </>;
}
