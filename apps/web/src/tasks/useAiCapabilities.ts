import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { translateActive } from "../localization";

export type AiCapabilities = { enabled: boolean; summaryEnabled: boolean; draftsEnabled: boolean; learningEnabled: boolean; questionsEnabled: boolean };
const none: AiCapabilities = { enabled: false, summaryEnabled: false, draftsEnabled: false, learningEnabled: false, questionsEnabled: false };

export function useAiCapabilities(available: boolean, siteId: string) {
  const [value, setValue] = useState<AiCapabilities>(none);
  useEffect(() => {
    if (!available || !siteId) { setValue(none); return; }
    let active = true;
    void apiGet<AiCapabilities>(`/api/ai/sites/${siteId}/capabilities`, translateActive("aiLoadFailed"))
      .then(next => { if (active) setValue(next); }).catch(() => { if (active) setValue(none); });
    return () => { active = false; };
  }, [available, siteId]);
  return value;
}
