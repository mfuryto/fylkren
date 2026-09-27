import { RichTextContent } from "../components/RichText";

export type ApprovalSnapshot = { objectType: string; content: unknown };
export type ApprovalField = { key: string; label: string; value: string; rich?: boolean; date?: boolean };
export type ApprovalSection = { key: string; title: string; fields: ApprovalField[] };

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(object) : [];
const text = (value: unknown): string => value == null ? "" : typeof value === "string" || typeof value === "number" ? String(value) : "";
const field = (key: string, label: string, value: unknown, rich = false, date = false): ApprovalField => ({ key, label, value: text(value), rich, date });
const section = (key: string, title: string, fields: ApprovalField[]): ApprovalSection => ({ key, title, fields: fields.filter(value => value.value.trim()) });
const priorityNames: Record<string, string> = { low: "Lav", normal: "Normal", high: "Høy", critical: "Kritisk" };
const decisionStatuses: Record<string, string> = { proposed: "Foreslått", active: "Gjeldende", superseded: "Erstattet", withdrawn: "Trukket tilbake" };

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
      section("task", "Oppdrag", [field("title", "Tittel", task.title), field("description", "Beskrivelse", task.description, true)]),
      section("plan", "Planbeslutning", [
        field("priority", "Prioritet", priorityNames[text(plan.proposedPriority)] ?? plan.proposedPriority),
        field("due", "Frist", plan.proposedDueAt, false, true),
      ]),
      ...steps.map((step, index) => {
        const id = text(step.id);
        const stepKey = `step-${id || index}`;
        return section(stepKey, text(step.name) || `Plansteg ${index + 1}`, [
          ...documents.filter(value => text(value.stepId) === id).map((value, entry) => field(`${stepKey}-content-${entry}`, "Innhold", value.content, true)),
          ...timeline.filter(value => text(value.stepId) === id).map((value, entry) => field(`${stepKey}-timeline-${entry}`, `Tidslinje ${entry + 1}`, `${text(value.date)} · ${text(value.description)}`)),
          ...links.filter(value => text(value.stepId) === id).map((value, entry) => field(`${stepKey}-link-${entry}`, `Dokument ${entry + 1}`, `${text(value.label)}: ${text(value.url)}`)),
        ]);
      }),
      section("allocations", "Oppgaver til underenheter", list(content.allocations).map((value, index) =>
        field(`allocation-${text(value.stepId)}-${text(value.unitId)}-${index}`, text(value.unit) || `Oppgave ${index + 1}`, value.instruction, true))),
      section("requests", "Anmodninger", list(content.requests).map((value, index) =>
        field(`request-${text(value.stepId)}-${text(value.targetSiteId)}-${index}`, text(value.targetSite) || `Anmodning ${index + 1}`, value.instruction, true))),
    ].filter(value => value.fields.length);
  }
  if (version.objectType === "final_report") {
    const report = object(content.report);
    return [
      section("task", "Oppdrag", [field("title", "Tittel", task.title)]),
      section("report", "Sluttrapport", [
        field("content", "Rapport", report.content, true),
        field("classification", "Klassifisering", report.classification),
        field("writtenAt", "Skrevet", report.writtenAt, false, true),
      ]),
    ].filter(value => value.fields.length);
  }
  if (version.objectType === "decision") {
    return [section("decision", "Beslutning", [
      field("title", "Tittel", content.title),
      field("decision", "Beslutning", content.decision, true),
      field("rationale", "Begrunnelse", content.rationale, true),
      field("status", "Status", decisionStatuses[text(content.status)] ?? content.status),
      field("decidedAt", "Besluttet", content.decidedAt, false, true),
      field("makers", "Beslutningstakere", list(content.decisionMakers).map(value => text(value.displayName)).filter(Boolean).join(", ")),
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
  if (!version) return <div className="approval-version-content"><p className="muted">Velg en versjon.</p></div>;
  const sections = approvalSections(version);
  const other = new Map((compareWith ? approvalSections(compareWith) : []).flatMap(value => value.fields.map(entry => [`${value.key}:${entry.key}`, entry.value] as const)));
  const format = (value: ApprovalField) => value.date && !Number.isNaN(Date.parse(value.value))
    ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value.value))
    : value.value;
  return <div className="approval-version-content">
    <strong>Versjon {version.versionNumber}</strong>
    {sections.length ? sections.map(group => <section className="approval-content-section" key={group.key}>
      <h4>{group.title}</h4>
      {group.fields.map(value => <div className={`approval-content-field${compareWith && other.get(`${group.key}:${value.key}`) !== value.value ? " approval-content-changed" : ""}`} key={value.key}>
        <strong>{value.label}</strong>
        {value.rich ? <RichTextContent value={value.value} /> : <p>{format(value)}</p>}
      </div>)}
    </section>) : <p className="muted">Ingen lesbar forhåndsvisning for denne versjonstypen.</p>}
    <details className="approval-raw-snapshot"><summary>Vis originale versjonsdata</summary><pre>{JSON.stringify(version.content, null, 2)}</pre></details>
  </div>;
}
