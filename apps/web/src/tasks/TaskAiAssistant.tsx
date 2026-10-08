import { useEffect, useState } from "react";
import { apiRequest, getAntiforgeryToken } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { RichTextContent } from "../components/RichText";
import { normalizeLanguage } from "../localization";
import { useTranslation } from "../localization/LocalizationProvider";
import type { WorkItem } from "../work/WorkItemModels";

type Feature = "summary" | "planning" | "risks" | "decisions" | "learning" | "questions";
type Result = { content: string; generatedAt: string; sourceUpdatedAt: string };
type StreamEvent = { type: "start"; sourceUpdatedAt: string; correlationId?: string } | { type: "heartbeat" } | { type: "delta"; content: string } | { type: "done"; generatedAt: string } | { type: "error"; code: string; providerStatus?: number; correlationId?: string };

export function TaskAiAssistant({ siteId, item, features, onClose, language, timeZone }: { siteId: string; item: WorkItem; features: Feature[]; onClose: () => void; language: string; timeZone: string }) {
  const t = useTranslation();
  const [feature, setFeature] = useState<Feature>(features[0] ?? "summary"), [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now(); setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  async function run() {
    setBusy(true); setMessage(""); setResult(null);
    let correlationId = "";
    try {
      const token = await getAntiforgeryToken();
      const response = await apiRequest(`/api/ai/sites/${siteId}/work-items/${item.id}/assist`, t("aiAssistFailed"), {
        method: "POST",
        headers: { "X-Fylkren-CSRF": token, "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ feature, question: feature === "questions" ? question : null, language: normalizeLanguage(language), stream: true }),
      });
      correlationId = response.headers.get("X-Fylkren-Correlation-ID") ?? "";
      if (!response.body) throw new Error(t("aiAssistFailed"));
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "", completed = false;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as StreamEvent;
        if (event.type === "start") { correlationId = event.correlationId ?? correlationId; setResult({ content: "", generatedAt: "", sourceUpdatedAt: event.sourceUpdatedAt }); }
        if (event.type === "delta") setResult(current => current ? { ...current, content: current.content + event.content } : current);
        if (event.type === "done") { completed = true; setResult(current => current ? { ...current, generatedAt: event.generatedAt } : current); }
        if (event.type === "error") { correlationId = event.correlationId ?? correlationId; const text = event.code === "ai_provider_timeout" ? t("aiProviderTimeout") : event.code === "ai_provider_rate_limited" ? t("aiProviderRateLimited") : event.providerStatus ? t("aiProviderHttpStatus", { status: event.providerStatus }) : t("aiProviderUnavailable"); throw new Error(correlationId ? `${text} ${t("correlation", { id: correlationId })}.` : text); }
      };
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; lines.forEach(consume);
        if (done) { consume(buffer); break; }
      }
      if (!completed) throw new Error(t("aiProviderUnavailable"));
    }
    catch (problem) { setMessage(errorMessage(problem, t("aiAssistFailed"))); } finally { setBusy(false); }
  }
  return <Modal title={`${t("aiAssistant")}: ${item.title}`} onClose={onClose}><div className="stacked-form">
    <p className="muted">{t("aiAssistantIntro")}</p>
    <div className="field"><label htmlFor="ai-assistant-feature">{t("aiFunctions")}</label><select id="ai-assistant-feature" value={feature} onChange={event => setFeature(event.target.value as Feature)}>{features.includes("summary") && <option value="summary">{t("aiSummaryFunction")}</option>}{features.includes("planning") && <option value="planning">{t("aiPlanningDraft")}</option>}{features.includes("risks") && <option value="risks">{t("aiRiskDraft")}</option>}{features.includes("decisions") && <option value="decisions">{t("aiDecisionDraft")}</option>}{features.includes("learning") && <option value="learning">{t("aiLearningFunction")}</option>}{features.includes("questions") && <option value="questions">{t("aiQuestionsFunction")}</option>}</select></div>
    {feature === "questions" && <div className="field"><label htmlFor="ai-assistant-question">{t("aiQuestion")}</label><textarea id="ai-assistant-question" rows={4} minLength={2} maxLength={1000} value={question} placeholder={t("aiQuestionPlaceholder")} onChange={event => setQuestion(event.target.value)}/></div>}
    <button className="primary-button" type="button" disabled={busy || feature === "questions" && question.trim().length < 2} onClick={() => void run()}>{busy ? t("aiWorking") : t("aiRun")}</button>
    {busy && <p className="status-message" role="status">{t(result?.content ? "aiReceiving" : "aiWaiting", { seconds: elapsed })}</p>}
    {message && <p className="status-message error-message" role="alert">{message}</p>}
    <section className="site-detail-block" aria-live="polite"><h3>{t("aiResult")}</h3>{result ? <><div className="ai-result"><RichTextContent value={result.content} /></div><p className="muted">{t("aiGeneratedFromVersion", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(result.sourceUpdatedAt)) })}</p></> : <p className="muted">{t("aiNoResult")}</p>}</section>
  </div></Modal>;
}
