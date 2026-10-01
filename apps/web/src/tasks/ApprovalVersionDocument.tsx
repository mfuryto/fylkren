import { RichTextContent } from "../components/RichText";
import { translateActive } from "../localization";

export type ApprovalSnapshot = { objectType: string; content: unknown };
export type ApprovalField = { key: string; label: string; value: string; rich?: boolean; date?: boolean };
export type ApprovalSection = { key: string; title: string; fields: ApprovalField[] };

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(object) : [];
const text = (value: unknown): string => value == null ? "" : typeof value === "string" || typeof value === "number" ? String(value) : "";
const field = (key: string, label: string, value: unknown, rich = false, date = false): ApprovalField => ({ key, label, value: text(value), rich, date });
const section = (key: string, title: string, fields: ApprovalField[]): ApprovalSection => ({ key, title, fields: fields.filter(value => value.value.trim()) });
const priorityNames = () => ({ low: translateActive("priorityLow"), normal: translateActive("priorityNormal"), high: translateActive("priorityHigh"), critical: translateActive("priorityCritical") } as Record<string, string>);
const decisionStatuses = () => ({ proposed: translateActive("decisionStatusProposed"), active: translateActive("decisionStatusActive"), superseded: translateActive("decisionStatusSuperseded"), withdrawn: translateActive("decisionStatusWithdrawn") } as Record<string, string>);

export function approvalSections(version: ApprovalSnapshot): ApprovalSection[] {
  const content = object(version.content);
  const task = object(content.task);
  if (version.objectType === "plan") {
    const plan = object(content.plan);
    const steps = list(content.steps);
    const documents = list(content.documents);
    const links = list(content.links);
    const timeline = list(content.timeline);
    return [
      section("task", translateActive("approvalTask"), [field("title", translateActive("approvalTitle"), task.title), field("description", translateActive("approvalDescription"), task.description, true)]),
      section("plan", translateActive("approvalPlanDecision"), [
        field("priority", translateActive("approvalPriority"), priorityNames()[text(plan.proposedPriority)] ?? plan.proposedPriority),
        field("due", translateActive("approvalDue"), plan.proposedDueAt, false, true),
      ]),
      ...steps.map((step, index) => {
        const id = text(step.id);
        const stepKey = `step-${id || index}`;
        return section(stepKey, text(step.name) || translateActive("approvalPlanStep", { number: index + 1 }), [
          ...documents.filter(value => text(value.stepId) === id).map((value, entry) => field(`${stepKey}-content-${entry}`, translateActive("approvalContent"), value.content, true)),
          ...timeline.filter(value => text(value.stepId) === id).map((value, entry) => field(`${stepKey}-timeline-${entry}`, translateActive("approvalTimeline", { number: entry + 1 }), `${text(value.date)} · ${text(value.description)}`)),
          ...links.filter(value => text(value.stepId) === id).map((value, entry) => field(`${stepKey}-link-${entry}`, translateActive("approvalDocument", { number: entry + 1 }), `${text(value.label)}: ${text(value.url)}`)),
        ]);
      }),
      section("allocations", translateActive("approvalSubunitTasks"), list(content.allocations).map((value, index) =>
        field(`allocation-${text(value.stepId)}-${text(value.unitId)}-${index}`, text(value.unit) || translateActive("approvalTaskNumber", { number: index + 1 }), value.instruction, true))),
      section("requests", translateActive("approvalRequests"), list(content.requests).map((value, index) =>
        field(`request-${text(value.stepId)}-${text(value.targetSiteId)}-${index}`, text(value.targetSite) || translateActive("approvalRequestNumber", { number: index + 1 }), value.instruction, true))),
    ].filter(value => value.fields.length);
  }
  if (version.objectType === "final_report") {
    const report = object(content.report);
    return [
      section("task", translateActive("approvalTask"), [field("title", translateActive("approvalTitle"), task.title)]),
      section("report", translateActive("approvalFinalReport"), [
        field("content", translateActive("approvalReport"), report.content, true),
        field("classification", translateActive("approvalClassification"), report.classification),
        field("writtenAt", translateActive("approvalWritten"), report.writtenAt, false, true),
      ]),
    ].filter(value => value.fields.length);
  }
  if (version.objectType === "decision") {
    return [section("decision", translateActive("approvalDecision"), [
      field("title", translateActive("approvalTitle"), content.title),
      field("decision", translateActive("approvalDecision"), content.decision, true),
      field("rationale", translateActive("approvalRationale"), content.rationale, true),
      field("status", translateActive("approvalStatus"), decisionStatuses()[text(content.status)] ?? content.status),
      field("decidedAt", translateActive("approvalDecided"), content.decidedAt, false, true),
      field("makers", translateActive("approvalDecisionMakers"), list(content.decisionMakers).map(value => text(value.displayName)).filter(Boolean).join(", ")),
    ])];
  }
  return [];
}

export function ApprovalVersionDocument({ version, compareWith, language, timeZone }: {
  version?: ApprovalSnapshot & { versionNumber: number };
  compareWith?: ApprovalSnapshot;
  language: string;
  timeZone: string;
}) {
  if (!version) return <div className="approval-version-content"><p className="muted">{translateActive("approvalSelectVersion")}</p></div>;
  const sections = approvalSections(version);
  const other = new Map((compareWith ? approvalSections(compareWith) : []).flatMap(value => value.fields.map(entry => [`${value.key}:${entry.key}`, entry.value] as const)));
  const format = (value: ApprovalField) => value.date && !Number.isNaN(Date.parse(value.value))
    ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value.value))
    : value.value;
  return <div className="approval-version-content">
    <strong>{translateActive("approvalVersion", { number: version.versionNumber })}</strong>
    {sections.length ? sections.map(group => <section className="approval-content-section" key={group.key}>
      <h4>{group.title}</h4>
      {group.fields.map(value => <div className={`approval-content-field${compareWith && other.get(`${group.key}:${value.key}`) !== value.value ? " approval-content-changed" : ""}`} key={value.key}>
        <strong>{value.label}</strong>
        {value.rich ? <RichTextContent value={value.value} /> : <p>{format(value)}</p>}
      </div>)}
    </section>) : <p className="muted">{translateActive("approvalNoPreview")}</p>}
    <details className="approval-raw-snapshot"><summary>{translateActive("approvalShowRaw")}</summary><pre>{JSON.stringify(version.content, null, 2)}</pre></details>
  </div>;
}
