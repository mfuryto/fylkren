export type LifecycleStage = "active" | "closed" | "archived";

export function LifecycleStateIcon({ stage }: { stage?: LifecycleStage }) {
  return <svg className={`lifecycle-state-icon lifecycle-state-${stage ?? "unknown"}`} data-stage={stage ?? "unknown"} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {stage === "closed" ? <><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" /><rect x="4" y="10" width="16" height="12" rx="2" fill="currentColor" /><path d="M12 14v4" stroke="var(--surface)" strokeWidth="2" /></>
      : stage === "archived" ? <><path d="M4 9h16v12H4zM2 3h20v6H2z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /><path d="M9 13h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></>
      : <rect x="4" y="4" width="16" height="16" rx="1" fill={stage === "active" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" />}
  </svg>;
}
