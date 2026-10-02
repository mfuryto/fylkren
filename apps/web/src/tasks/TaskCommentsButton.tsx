import { useEffect, useId, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { Modal } from "../components/Modal";
import { PaginationNav } from "../components/PaginationNav";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";

type Comment = { id: string; authorName: string; text: string; createdAt: string };
type CommentPage = { items: Comment[]; total: number; page: number };
type Props = { siteId: string; itemId: string; title: string; timeZone?: string };

export function TaskCommentsButton(props: Props) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  return <>
    <button className="task-icon-action" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">☵</i><span>{t("taskCommentsTitle")}{count !== null && count > 0 ? ` (${count})` : ""}</span></button>
    {open && <TaskCommentsDialog {...props} onClose={() => setOpen(false)} onCount={setCount} />}
  </>;
}

function TaskCommentsDialog({ siteId, itemId, title, timeZone, onClose, onCount }: Props & { onClose: () => void; onCount: (count: number) => void }) {
  const t = useTranslation();
  const language = useLanguage();
  const fieldId = useId();
  const [data, setData] = useState<CommentPage>({ items: [], total: 0, page: 1 });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/work/sites/${siteId}/items/${itemId}/comments`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiGet<CommentPage>(`${path}?page=${page}`, t("taskCommentsLoadFailed"), { signal: controller.signal })
      .then(result => { setData(result); onCount(result.total); })
      .catch(problem => { if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : t("taskCommentsLoadFailed")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, page, reload, t, onCount]);
  async function post(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !text.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiMutate(path, "POST", { text: text.trim() }, t("taskCommentSaveFailed"));
      setText("");
      setPage(1);
      setReload(value => value + 1);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("taskCommentSaveFailed"));
    } finally { setSaving(false); }
  }
  return <Modal title={t("taskCommentsTitle")} onClose={onClose}>
    <strong>{title}</strong>
    <p className="muted">{t("taskCommentsIntro")}</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    {loading ? <p role="status">{t("loading")}</p> : <>
      {data.items.length === 0 ? <p className="empty-state-inline">{t("taskCommentsEmpty")}</p> : <div className="task-comment-list">{data.items.map(comment => <TaskCommentEntry key={comment.id} comment={comment} language={language} timeZone={timeZone} />)}</div>}
      <PaginationNav page={data.page} totalItems={data.total} onPageChange={setPage} label={t("taskCommentsTitle")} />
    </>}
    <form className="stacked-form" onSubmit={post}>
      <div className="field"><label htmlFor={fieldId}>{t("taskCommentText")}</label><textarea id={fieldId} required maxLength={10000} rows={3} value={text} disabled={saving} onChange={event => setText(event.target.value)} /></div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{t("close")}</button><button className="primary-button" disabled={loading || saving || !text.trim()}>{t("taskCommentPost")}</button></div>
    </form>
  </Modal>;
}

export function TaskCommentEntry({ comment, language, timeZone }: { comment: Comment; language: string; timeZone?: string }) {
  return <article className="task-comment">
    <header><strong>{comment.authorName}</strong> <time dateTime={comment.createdAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(comment.createdAt))}</time></header>
    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.text}</p>
  </article>;
}
