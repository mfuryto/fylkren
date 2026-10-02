import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../localization/LocalizationProvider";
import { errorMessage } from "../api/errors";
import { PaginationNav } from "../components/PaginationNav";
import { SectionHelp } from "../components/SectionHelp";
import { WorkReference } from "../components/WorkReference";
import { buildAppHash, type AppLocation } from "../navigation/permalinks";
import { getLearning, type LearningPage as LearningResponse, type Lesson } from "./learningApi";
import { LessonDetails } from "./LessonDetails";
import { lessonPriorityKeys, lessonStatusKeys } from "./learningModels";

export function LearningPage({ language, timeZone, permalink }: { language: string; timeZone: string; permalink: AppLocation }) {
  const t = useTranslation();
  const [data, setData] = useState<LearningResponse | null>(null);
  const [site, setSite] = useState(permalink.siteId ?? "");
  const [unit, setUnit] = useState(permalink.unitId ?? "");
  const [view, setView] = useState("active");
  const [kind, setKind] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [help, setHelp] = useState(false);
  const query = useMemo(() => {
    const params = new URLSearchParams({ view, sort, page: String(page) });
    if (site) params.set("siteId", site);
    if (unit) params.set("unitId", unit);
    if (kind) params.set("kind", kind);
    if (priority) params.set("priority", priority);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [site, unit, view, kind, priority, search, sort, page]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      void getLearning(new URLSearchParams(query), controller.signal)
        .then(result => { if (!controller.signal.aborted) { setData(result); setPage(result.page); } })
        .catch(problem => { if (!controller.signal.aborted) setError(errorMessage(problem, t("learningLoadFailed"))); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, refresh]);
  const sites = [...new Map((data?.levels ?? []).map(level => [level.siteId, level.siteName])).entries()];
  const units = (data?.levels ?? []).filter(level => !site || level.siteId === site);
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = ["year", "month", "day"].map(type => dateParts.find(part => part.type === type)?.value).join("-");
  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <div className="page learning-page">
    <header className="page-header"><div><h1>{t("navLearning")}</h1><p className="muted">{t("learningIntro")}</p></div><button className="help-button" type="button" onClick={() => setHelp(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>
    <div className="learning-toolbar">
      {sites.length > 1 && <div className="field"><label htmlFor="learning-site">{t("site")}</label><select id="learning-site" value={site} onChange={event => { setFilter(setSite, event.target.value); setUnit(""); }}><option value="">{t("learningAllSites")}</option>{sites.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></div>}
      {units.length > 1 && <div className="field"><label htmlFor="learning-unit">{t("workLevel")}</label><select id="learning-unit" value={unit} onChange={event => setFilter(setUnit, event.target.value)}><option value="">{t("learningAllLevels")}</option>{units.map(level => <option value={level.unitId} key={level.unitId}>{level.unitName}{!site && sites.length > 1 ? ` · ${level.siteName}` : ""}</option>)}</select></div>}
      <div className="field"><label htmlFor="learning-view">{t("show")}</label><select id="learning-view" value={view} onChange={event => setFilter(setView, event.target.value)}><option value="active">{t("learningActive")}</option><option value="closed">{t("learningClosed")}</option><option value="all">{t("all")}</option></select></div>
      <div className="field"><label htmlFor="learning-kind">{t("navLearning")}</label><select id="learning-kind" value={kind} onChange={event => setFilter(setKind, event.target.value)}><option value="">{t("all")}</option><option value="positive">{t("learningPositive")}</option><option value="improvement">{t("learningImprovement")}</option></select></div>
      <div className="field"><label htmlFor="learning-priority">{t("learningPriority")}</label><select id="learning-priority" value={priority} onChange={event => setFilter(setPriority, event.target.value)}><option value="">{t("all")}</option>{Object.entries(lessonPriorityKeys).map(([value, key]) => <option value={value} key={value}>{t(key)}</option>)}</select></div>
      <div className="field learning-search"><label htmlFor="learning-search">{t("search")}</label><input id="learning-search" type="search" value={search} onChange={event => setFilter(setSearch, event.target.value)}/></div>
      <div className="field"><label htmlFor="learning-sort">{t("sortBy")}</label><select id="learning-sort" value={sort} onChange={event => setFilter(setSort, event.target.value)}><option value="priority">{t("learningPriority")}</option><option value="due">{t("riskDueDate")}</option><option value="newest">{t("sortNewest")}</option><option value="oldest">{t("sortOldest")}</option></select></div>
    </div>
    {error && <p className="status-message error-message" role="alert">{error}</p>}
    {loading && <p className="muted" role="status">{t("loading")}</p>}
    {!loading && !error && data?.items.length === 0 && <p className="empty-list-message">{t("learningEmpty")}</p>}
    {!!data?.items.length && <div className="learning-table-scroll" aria-busy={loading}><table className="learning-table"><thead><tr><th>#</th><th>{t("approvalTask")}</th><th>{t("navLearning")}</th><th>{t("learningPriority")}</th><th>{t("approvalStatus")}</th><th>{t("riskDueDate")}</th></tr></thead><tbody>{data.items.map(lesson => <tr key={lesson.id}>
      <td>{lesson.number}</td><td><a href={buildAppHash({ page: "Tasks", siteId: lesson.siteId, itemId: lesson.workItemId })} title={lesson.workTitle}><WorkReference referenceCode={lesson.workReference}/></a></td>
      <td><button className="learning-point-title" type="button" onClick={() => setSelected(lesson)}>{lesson.text}</button><small className="muted">{t(lesson.kind === "positive" ? "learningPositive" : "learningImprovement")}{lesson.ownerName ? ` · ${lesson.ownerName}` : ""}</small></td>
      <td><span className={`learning-priority learning-priority-${lesson.priority}`}>{t(lessonPriorityKeys[lesson.priority])}</span></td><td>{t(lessonStatusKeys[lesson.status])}</td>
      <td className={lesson.dueOn && lesson.dueOn < today && ["new", "in_progress"].includes(lesson.status) ? "learning-overdue" : ""}>{lesson.dueOn ? new Date(`${lesson.dueOn}T12:00:00`).toLocaleDateString(language) : "–"}</td>
    </tr>)}</tbody></table></div>}
    {data && <PaginationNav page={data.page} totalItems={data.total} onPageChange={setPage} label={t("navLearning")}/>}
    {selected && <LessonDetails key={selected.id} lesson={selected} language={language} timeZone={timeZone} onClose={() => setSelected(null)} onReviewed={() => { setSelected(null); setRefresh(value => value + 1); }}/>}
    {help && <SectionHelp title={t("learningHelpTitle")} intro={t("learningHelpText")} steps={[]} note={t("learningInternal")} onClose={() => setHelp(false)}/>}
  </div>;
}
