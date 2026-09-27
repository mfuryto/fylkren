import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

export type RequestRecipient = {
  id: string;
  instanceId: string;
  name: string;
  kind: "site" | "unit";
};

export function useRequestRecipientSearch({
  siteId,
  sourceUnitId,
  query,
  enabled = true,
  recipientSelected = false,
  onError,
}: {
  siteId: string;
  sourceUnitId?: string | null;
  query: string;
  enabled?: boolean;
  recipientSelected?: boolean;
  onError: (message: string) => void;
}) {
  const [recipients, setRecipients] = useState<RequestRecipient[]>([]);

  useEffect(() => {
    if (!enabled || !siteId || query.trim().length < 2 || recipientSelected) {
      setRecipients([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const source = sourceUnitId
        ? `sourceUnitId=${encodeURIComponent(sourceUnitId)}&`
        : "";
      void apiGet<RequestRecipient[]>(
        `/api/work/sites/${siteId}/request-recipients?${source}search=${encodeURIComponent(query.trim())}`,
        "Mottakere kunne ikke søkes opp.",
        { signal: controller.signal },
      )
        .then(setRecipients)
        .catch((problem) => {
          if (controller.signal.aborted) return;
          setRecipients([]);
          onError(
            problem instanceof Error
              ? problem.message
              : "Mottakere kunne ikke søkes opp.",
          );
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, onError, query, recipientSelected, siteId, sourceUnitId]);

  return [recipients, setRecipients] as const;
}
