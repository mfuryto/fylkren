import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProductShell } from "@fylkren/ui";
import { LocalizationProvider, useTranslation } from "../src/localization/LocalizationProvider";
import { LearningPage } from "../src/learning/LearningPage";
import { TaskFinalReportDialog } from "../src/tasks/TaskFinalReportDialog";
import { navigationCountLabel, useNavigationCounts } from "../src/app/useNavigationCounts";
import { apiMutate } from "../src/api/client";
import "@fylkren/ui";
const now = new Date().toISOString();
const canManage = new URLSearchParams(location.search).get("role") !== "reader";
const makeLesson = (id, number, kind, text) => ({ id, number, kind, text, siteId: "site", unitId: "unit", workItemId: "task", workReference: "OPS-000123", workTitle: "Synthetic coordination task", authorName: "Synthetic author", createdAt: now, updatedAt: now, status: "new", priority: "normal", actionPlan: "", treatmentNote: "", dueOn: null, ownerName: null, version: 1, canManage });
let lessons = [makeLesson("point-one", 1, "positive", "Shared status updates helped coordinate work."), makeLesson("point-two", 2, "improvement", "Handover information arrived too late.")];
const entries = new Map();
window.testReportPayload = null;
window.fetch = async (path, init = {}) => {
  const url = new URL(String(path), location.origin);
  const body = init.body ? JSON.parse(init.body) : {};
  if (url.pathname === "/api/security/antiforgery") return Response.json({ token: "synthetic" });
  if (url.pathname === "/api/work/navigation-counts") return Response.json({ tasks: 0, planning: 0, execution: 0, learning: lessons.filter(value => ["new", "in_progress"].includes(value.status)).length });
  if (url.pathname === "/api/work/learning") {
    let items = lessons.filter(value => url.searchParams.get("view") === "all" || (url.searchParams.get("view") === "closed" ? ["implemented", "dismissed"].includes(value.status) : ["new", "in_progress"].includes(value.status)));
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    if (search) items = items.filter(value => `${value.text} ${value.workReference}`.toLowerCase().includes(search));
    return Response.json({ items, levels: [{ siteId: "site", siteName: "Synthetic site", unitId: "unit", unitName: "Coordination", canManage: true }], total: items.length, page: 1, totalPages: 1 });
  }
  const match = url.pathname.match(/^\/api\/work\/learning\/([^/]+)\/(entries|review|comments)$/);
  if (match) {
    const lesson = lessons.find(value => value.id === match[1]);
    if (match[2] === "entries") return Response.json({ items: entries.get(lesson.id) ?? [], total: (entries.get(lesson.id) ?? []).length, page: 1, totalPages: 1 });
    if (match[2] === "review") {
      Object.assign(lesson, body, { version: lesson.version + 1, ownerName: "Synthetic leader" });
      entries.set(lesson.id, [{ id: crypto.randomUUID(), kind: "review", text: body.treatmentNote, status: body.status, priority: body.priority, actionPlan: body.actionPlan, dueOn: body.dueOn, authorName: "Synthetic leader", createdAt: now }, ...(entries.get(lesson.id) ?? [])]);
      return new Response(null, { status: 204 });
    }
    entries.set(lesson.id, [{ id: crypto.randomUUID(), kind: "comment", text: body.text, authorName: "Synthetic reader", createdAt: now }, ...(entries.get(lesson.id) ?? [])]);
    return Response.json({ id: "new-comment" }, { status: 201 });
  }
  if (url.pathname.endsWith("/final-report")) {
    window.testReportPayload = body;
    for (const point of body.lessons ?? []) if (!lessons.some(value => value.id === point.id)) lessons.push(makeLesson(point.id, lessons.length + 1, point.kind, point.text));
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected synthetic request ${path}`);
};
function Preview() {
  const t = useTranslation();
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const counts = useNavigationCounts({ authenticated: true, personId: "reader", isPlatformManager: false, hasOperationalRole: true }, "Learning");
  const item = { id: "task", title: "Synthetic coordination task", referenceCode: "OPS-000123" };
  return <ProductShell activeItem="Learning" navigationItems={["Overview", "Tasks", "Reports", "Workload", "Learning"]} navigationLabel={name => navigationCountLabel(t(({ Overview: "navOverview", Tasks: "navTasks", Reports: "navReports", Workload: "navWorkload", Learning: "navLearning" })[name]), name, counts)} userLabel="Synthetic leader" version="Preview">
    <button id="preview-report" className="secondary-button" onClick={() => setEditor({ item, content: "# Public final report\n\nCompleted synthetic work.", classification: "", executionHistory: null, historyLoading: false, lessons: [], savedLessons: lessons, lessonsLoading: false, lessonsError: "" })}>{t("approvalFinalReport")}</button>
    <LearningPage key={refresh} language={new URLSearchParams(location.search).get("language") ?? "nb-NO"} timeZone="Europe/Oslo" permalink={{ page: "Learning" }}/>
    {editor && <TaskFinalReportDialog editor={editor} setEditor={setEditor} childReports={[]} markings={[]} language="en-US" busy={false} renderReport={() => null} onSubmit={async event => { event.preventDefault(); await apiMutate("/api/work/sites/site/items/task/final-report", "PUT", { content: editor.content, classification: null, lessons: editor.lessons }, "Synthetic save failed"); setEditor(null); setRefresh(value => value + 1); }}/>}
  </ProductShell>;
}
createRoot(document.getElementById("root")).render(<LocalizationProvider language={new URLSearchParams(location.search).get("language") ?? "nb-NO"}><Preview/></LocalizationProvider>);
