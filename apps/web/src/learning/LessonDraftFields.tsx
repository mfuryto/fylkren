import { useTranslation } from "../localization/LocalizationProvider";
import type { Lesson, LessonDraft, LessonKind } from "./learningApi";

export function LessonDraftFields({ drafts, saved, onChange, loading, error }: { drafts: LessonDraft[]; saved: Lesson[]; onChange: (value: LessonDraft[]) => void; loading: boolean; error: string }) {
  const t = useTranslation();
  return <section className="learning-report-points">
    <h3>{t("navLearning")}</h3><p className="muted">{t("learningInternal")}</p>
    {error && <p className="status-message error-message">{error}</p>}
    {loading && <p className="muted">{t("loading")}</p>}
    {(["positive", "improvement"] as LessonKind[]).map(kind => <fieldset key={kind}>
      <legend>{t(kind === "positive" ? "learningPositive" : "learningImprovement")}</legend>
      {saved.some(point => point.kind === kind) && <ol className="learning-saved-points" aria-label={t("learningSavedPoints")}>{saved.filter(point => point.kind === kind).sort((a, b) => a.number - b.number).map((point, index) => <li key={point.id} value={index + 1}>{point.text}</li>)}</ol>}
      <ol className="learning-draft-points">{drafts.filter(point => point.kind === kind).map((point, index) => <li key={point.id} value={saved.filter(value => value.kind === kind).length + index + 1}>
        <textarea aria-label={t(kind === "positive" ? "learningPositive" : "learningImprovement")} value={point.text} required minLength={2} maxLength={4000} rows={2} onChange={event => onChange(drafts.map(value => value.id === point.id ? { ...value, text: event.target.value } : value))}/>
        <button className="text-button" type="button" onClick={() => onChange(drafts.filter(value => value.id !== point.id))}>{t("remove")}</button>
      </li>)}</ol>
      <button className="secondary-button" type="button" disabled={loading || !!error || drafts.length >= 50 || saved.length + drafts.length >= 100} onClick={() => onChange([...drafts, { id: crypto.randomUUID(), kind, text: "" }])}>{t("learningAdd")}</button>
    </fieldset>)}
  </section>;
}
