import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import type { Session } from "../work/WorkContextModels";

export type NavigationCounts = { tasks: number; planning: number; execution: number; learning: number };

export function navigationCountLabel(label: string, item: string, counts: NavigationCounts | null) {
  const count = item === "Tasks" ? counts?.tasks : item === "Planning" ? counts?.planning : item === "Execution" ? counts?.execution : item === "Learning" ? counts?.learning : 0;
  return count && count > 0 ? `${label} (${count})` : label;
}

export function useNavigationCounts(session: Session | null, activeItem: string) {
  const [result, setResult] = useState<{ personId: string; counts: NavigationCounts } | null>(null);
  const personId = session?.authenticated && !session.isPlatformManager && !session.mustChangePassword &&
    (session.hasOperationalRole || session.canPlan || session.canExecute) ? session.personId : undefined;
  useEffect(() => {
    if (!personId) return;
    let controller: AbortController | undefined;
    let disposed = false;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      void apiGet<NavigationCounts>("/api/work/navigation-counts", "Work counts could not be loaded.", { signal: request.signal })
        .then(counts => { if (!disposed && !request.signal.aborted) setResult({ personId, counts }); })
        .catch(() => { if (!disposed && !request.signal.aborted) setResult(null); });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("fylkren:work-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("fylkren:work-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [personId, activeItem]);
  return personId && result?.personId === personId ? result.counts : null;
}
