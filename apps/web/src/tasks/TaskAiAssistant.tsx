import { useState } from "react";
import { apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { useTranslation } from "../localization/LocalizationProvider";
import type { WorkItem } from "../work/WorkItemModels";

type Feature = "summary" | "drafts" | "learning" | "questions";
type Result = { content: string; generatedAt: string; sourceUpdatedAt: string };

export function TaskAiAssistant({ siteId, item, features, onClose, language, timeZone }: { siteId: string; item: WorkItem; features: Feature[]; onClose: () => void; language: string; timeZone: string }) {
  const t = useTranslation();
  const [feature, setFeature] = useState<Feature>(features[0] ?? "summary"), [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function run() {
    setBusy(true); setMessage(""); setResult(null);
    try { setResult(await apiMutate<Result>(`/api/ai/sites/${siteId}/work-items/${item.id}/assist`, "POST", { feature, question: feature === "questions" ? question : null, language }, t("aiAssistFailed"))); }
    catch (problem) { setMessage(errorMessage(problem, t("aiAssistFailed"))); } finally { setBusy(false); }
  }
  return <Modal title={`${t("aiAssistant")}: ${item.title}`} onClose={onClose}><div className="stacked-form">
    <p className="muted">{t("aiAssistantIntro")}</p>
    <div className="field"><label htmlFor="ai-assistant-feature">{t("aiFunctions")}</label><select id="ai-assistant-feature" value={feature} onChange={event => setFeature(event.target.value as Feature)}>{features.includes("summary") && <option value="summary">{t("aiSummaryFunction")}</option>}{features.includes("drafts") && <option value="drafts">{t("aiDraftsFunction")}</option>}{features.includes("learning") && <option value="learning">{t("aiLearningFunction")}</option>}{features.includes("questions") && <option value="questions">{t("aiQuestionsFunction")}</option>}</select></div>
    {feature === "questions" && <div className="field"><label htmlFor="ai-assistant-question">{t("aiQuestion")}</label><textarea id="ai-assistant-question" rows={4} minLength={2} maxLength={1000} value={question} placeholder={t("aiQuestionPlaceholder")} onChange={event => setQuestion(event.target.value)}/></div>}
    <button className="primary-button" type="button" disabled={busy || feature === "questions" && question.trim().length < 2} onClick={() => void run()}>{t("aiRun")}</button>
    {message && <p className="status-message error-message" role="alert">{message}</p>}
    <section className="site-detail-block" aria-live="polite"><h3>{t("aiResult")}</h3>{result ? <><div className="ai-result">{result.content}</div><p className="muted">{t("aiGeneratedFromVersion", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(result.sourceUpdatedAt)) })}</p></> : <p className="muted">{t("aiNoResult")}</p>}</section>
  </div></Modal>;
}
