import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { PaginationNav } from "../components/PaginationNav";
import { useTranslation } from "../localization/LocalizationProvider";
import { errorMessage } from "../api/errors";
import { commentLearning, getLearningEntries, reviewLearning, type EntryPage, type Lesson, type LessonPriority, type LessonReview, type LessonStatus } from "./learningApi";
import { lessonPriorityKeys, lessonStatusKeys, validLessonReview } from "./learningModels";
import { AiAssistButton } from "../components/AiAssistButton";

export function LessonDetails({ lesson, language, timeZone, aiEnabled = false, onAi, onClose, onReviewed }: { lesson: Lesson; language: string; timeZone: string; aiEnabled?: boolean; onAi?: () => void; onClose: () => void; onReviewed: () => void }) {
  const t = useTranslation();
  const [entries, setEntries] = useState<EntryPage | null>(null);
  const [entryPage, setEntryPage] = useState(1);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<LessonReview>({ version: lesson.version, status: lesson.status, priority: lesson.priority, actionPlan: lesson.actionPlan, treatmentNote: lesson.treatmentNote, dueOn: lesson.dueOn });
  useEffect(() => {
    let disposed = false;
    setEntries(null);
    void getLearningEntries(lesson.id, entryPage).then(value => { if (!disposed) setEntries(value); })
      .catch(problem => { if (!disposed) setError(errorMessage(problem, t("learningLoadFailed"))); });
    return () => { disposed = true; };
  }, [lesson.id, entryPage]);
  const date = (value: string) => new Date(value).toLocaleString(language, { timeZone });
  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!validLessonReview(review, lesson.status, lesson.treatmentNote)) return;
    setBusy(true); setError("");
    try { await reviewLearning(lesson.id, review); onReviewed(); }
    catch (problem) { setError(errorMessage(problem, t("learningSaveFailed"))); }
    finally { setBusy(false); }
  }
  async function submitComment(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await commentLearning(lesson.id, comment);
      setComment("");
      const result = await getLearningEntries(lesson.id, 1);
      setEntryPage(1); setEntries(result);
    } catch (problem) { setError(errorMessage(problem, t("learningSaveFailed"))); }
    finally { setBusy(false); }
  }
  return <Modal title={`${t("navLearning")} · ${lesson.workReference} · ${lesson.number}`} onClose={onClose} dismissible={!busy}>
    <div className="learning-detail">
      <div className="section-heading"><strong>{lesson.workTitle}</strong>{aiEnabled && onAi && <AiAssistButton label={t("aiLearningAction")} onClick={onAi}/>}</div><p className="learning-text">{lesson.text}</p>
      <small className="muted">{lesson.authorName} · {date(lesson.createdAt)}</small>
      {lesson.ownerName && <p className="muted">{t("learningHandledBy")}: {lesson.ownerName}</p>}
      {error && <p className="status-message error-message" role="alert">{error}</p>}
      {lesson.canManage ? <form className="stacked-form learning-review" onSubmit={submitReview}>
        <h3>{t("learningReview")}</h3>
        <p className="muted">{t("learningReviewHint")}</p>
        <div className="learning-review-fields">
          <div className="field"><label htmlFor="lesson-status">{t("approvalStatus")}</label><select id="lesson-status" disabled={busy} value={review.status} onChange={event => setReview({ ...review, status: event.target.value as LessonStatus, treatmentNote: ["implemented", "dismissed"].includes(lesson.status) && ["new", "in_progress"].includes(event.target.value) ? "" : review.treatmentNote })}>{Object.entries(lessonStatusKeys).map(([status, key]) => <option value={status} key={status}>{t(key)}</option>)}</select></div>
          <div className="field"><label htmlFor="lesson-priority">{t("learningPriority")}</label><select id="lesson-priority" disabled={busy} value={review.priority} onChange={event => setReview({ ...review, priority: event.target.value as LessonPriority })}>{Object.entries(lessonPriorityKeys).map(([priority, key]) => <option value={priority} key={priority}>{t(key)}</option>)}</select></div>
          <div className="field"><label htmlFor="lesson-due">{t("riskDueDate")}</label><input id="lesson-due" type="date" disabled={busy} required={review.status === "in_progress"} value={review.dueOn ?? ""} onChange={event => setReview({ ...review, dueOn: event.target.value || null })}/></div>
        </div>
        <div className="field"><label htmlFor="lesson-plan">{t("learningActionPlan")}</label><textarea id="lesson-plan" rows={2} maxLength={2000} disabled={busy} value={review.actionPlan} onChange={event => setReview({ ...review, actionPlan: event.target.value })}/></div>
        <div className="field"><label htmlFor="lesson-note">{t("learningTreatmentNote")}</label><textarea id="lesson-note" rows={2} maxLength={4000} disabled={busy} value={review.treatmentNote} onChange={event => setReview({ ...review, treatmentNote: event.target.value })}/></div>
        <div><button className="primary-button" disabled={busy || !validLessonReview(review, lesson.status, lesson.treatmentNote)}>{t("save")}</button></div>
      </form> : <div className="learning-current-review"><p className="muted">{t("learningReadOnlyHint")}</p><strong>{t(lessonStatusKeys[lesson.status])} · {t(lessonPriorityKeys[lesson.priority])}</strong><p className="learning-text">{lesson.actionPlan}</p><p className="learning-text">{lesson.treatmentNote}</p>{lesson.dueOn && <p>{t("riskDueDate")}: {lesson.dueOn}</p>}</div>}
      <h3>{t("learningHistory")}</h3>
      {!entries ? <p className="muted">{t("loading")}</p> : <>
        <ol className="learning-history">{entries.items.map(entry => <li key={entry.id}>
          <small className="muted">{entry.authorName} · {date(entry.createdAt)}</small>
          {entry.kind === "review" && entry.status && entry.priority && <strong>{t(lessonStatusKeys[entry.status])} · {t(lessonPriorityKeys[entry.priority])}</strong>}
          {entry.actionPlan && <p className="learning-text">{entry.actionPlan}</p>}
          {entry.dueOn && <small>{t("riskDueDate")}: {entry.dueOn}</small>}
          {entry.text && <p className="learning-text">{entry.text}</p>}
        </li>)}</ol>
        {entries.total === 0 && <p className="muted">{t("taskCommentsEmpty")}</p>}
        <PaginationNav page={entries.page} totalItems={entries.total} onPageChange={setEntryPage} label={t("learningHistory")}/>
      </>}
      <form className="stacked-form" onSubmit={submitComment}><div className="field"><label htmlFor="lesson-comment">{t("taskCommentText")}</label><textarea id="lesson-comment" rows={2} maxLength={4000} required minLength={2} disabled={busy} value={comment} onChange={event => setComment(event.target.value)}/></div><div><button className="secondary-button" disabled={busy || comment.trim().length < 2}>{t("learningComment")}</button></div></form>
    </div>
  </Modal>;
}
