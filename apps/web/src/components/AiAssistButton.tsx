import type { ButtonHTMLAttributes } from "react";

export function AiAssistButton({ label, working = false, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; working?: boolean }) {
  return <button {...props} className={`ai-assist-button${working ? " working" : ""}${className ? ` ${className}` : ""}`} type={props.type ?? "button"}>
    <svg className="ai-assist-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8c.55 3.55 2.1 5.1 5.65 5.65-3.55.55-5.1 2.1-5.65 5.65-.55-3.55-2.1-5.1-5.65-5.65C9.9 7.9 11.45 6.35 12 2.8Z"/><path d="M18.2 13.2c.3 2.05 1.25 3 3.3 3.3-2.05.3-3 1.25-3.3 3.3-.3-2.05-1.25-3-3.3-3.3 2.05-.3 3-1.25 3.3-3.3ZM5.2 14.3c.22 1.35.83 1.96 2.18 2.18-1.35.22-1.96.83-2.18 2.18-.22-1.35-.83-1.96-2.18-2.18 1.35-.22 1.96-.83 2.18-2.18Z"/></svg>
    <span>{label}</span>
  </button>;
}
