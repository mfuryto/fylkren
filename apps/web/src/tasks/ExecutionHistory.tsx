import { RichTextContent } from "../components/RichText";
import type { ExecutionRun, ExecutionStep } from "../workflows/ExecutionModels";
import { WorkflowTimeline } from "../workflows/WorkflowFields";

export type ExecutionHistory = Omit<ExecutionRun, "steps"> & { steps: ExecutionStep[] };

export function ExecutionHistoryDetails({ execution, language, loading = false, loaded = true }: {
  execution: ExecutionHistory | null;
  language: string;
  loading?: boolean;
  loaded?: boolean;
}) {
  return <>
    {loading && <p className="muted">Loading execution…</p>}
    {loaded && !execution?.steps.length && <p className="muted">No documented execution workflow.</p>}
    {execution?.definitionName && <p className="muted">Arbeidsflyt: {execution.definitionName}</p>}
    {execution?.steps.map(step => <section key={step.id} className="workflow-definition"><h4>{step.name}</h4>{step.hasTimeline && execution.timelineStartedOn && <WorkflowTimeline language={language} startDate={execution.timelineStartedOn} events={step.timelineEvents ?? []} />}{step.content ? <RichTextContent value={step.content} /> : <p className="muted">No documentation.</p>}{step.externalRequests.map(request => <div key={request.id} className="site-detail-block"><strong>External follow-up: {request.recipient}</strong><p>{request.requestText}</p>{request.responseText && <><strong>Received response</strong><p>{request.responseText}</p></>}</div>)}</section>)}
  </>;
}
