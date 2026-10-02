import { createRoot } from "react-dom/client";
import { ProductShell } from "@fylkren/ui";
import { LocalizationProvider, useTranslation } from "../src/localization/LocalizationProvider";
import { WorkOverview } from "../src/overview/OverviewPages";
import { TasksPage } from "../src/tasks/TasksPage";
import { PlanningPage } from "../src/workflows/PlanningPage";
import { ExecutionPage } from "../src/workflows/ExecutionPage";
import { ReportsPage } from "../src/reports/ReportsPage";
import { context, items, planning, execution, reports } from "./documentation-data";
import "@fylkren/ui";

window.documentationRequests = [];
window.fetch = async path => {
  const url = new URL(String(path), location.origin);
  const route = url.pathname;
  window.documentationRequests.push(route);
  if (route === "/api/work/context") return Response.json(context);
  if (route === "/api/work/sites/site/items/overview") return Response.json(items);
  if (route === "/api/work/sites/site/descendant-workload") return Response.json({ active: 9, nearDeadline: 3, overdue: 0, siteSummaries: [], unitSummaries: [
    { unitId: "planning", active: 3, underway: 2, statusCounts: [{ status: "planning", count: 2 }, { status: "assigned", count: 1 }] },
    { unitId: "logistics", active: 4, underway: 3, statusCounts: [{ status: "execution", count: 3 }, { status: "assigned", count: 1 }] },
    { unitId: "communications", active: 2, underway: 1, statusCounts: [{ status: "execution", count: 1 }, { status: "assigned", count: 1 }] },
  ] });
  if (route === "/api/work/sites/site/items") {
    const visible = items.filter(value => value.assignedUnitId === null && value.status !== "completed");
    return Response.json({ items: visible, total: visible.length, page: 1, pageSize: 20, totalPages: 1, summary: { active: 5, inProgress: 2, inReview: 1, overdue: 0 } });
  }
  if (route === "/api/work/sites/site/types") return Response.json([{ id: "task-type", name: "Assignment", abbreviation: "ASG", isActive: true, inUse: true }]);
  if (route.includes("/lookups/")) return Response.json([]);
  if (route === "/api/workflows/planning/sites/site") return Response.json({ items: [planning], levels: [{ assignedUnitId: null, name: "Top level" }], total: 1, page: 1 });
  if (route === "/api/execution/sites/site") return Response.json({ items: [execution], definitions: [{ id: "flow", name: "Preparedness exercise", ownerUnitId: null }], managedItemIds: [execution.id], total: 1, page: 1 });
  if (route === "/api/work/sites/site/reports") return Response.json({ reports, years: [2026], yearCounts: [{ year: 2026, count: reports.length }], total: reports.length });
  throw new Error(`Unexpected documentation preview request: ${route}`);
};
const active = new URLSearchParams(location.search).get("page") ?? "Overview";
const session = { authenticated: true, personId: "reader", isPlatformManager: false, hasOperationalRole: true, canPlan: true, canExecute: true, isTopLevelLeader: true };
const common = { language: "en-US", timeZone: "Europe/Oslo", classificationMarkings: [], permalink: { page: active, siteId: "site", year: "2026", ...(active === "Planning" ? { runId: "plan" } : active === "Execution" ? { itemId: execution.id } : {}) } };
function Preview() {
  const t = useTranslation();
  const keys = { Overview: "navOverview", Tasks: "navTasks", Planning: "navPlanning", Execution: "navExecution", Reports: "navReports", Workload: "navWorkload", Learning: "navLearning" };
  // Counts represent other available work at the authorized levels, rather than the displayed claimed runs.
  const counts = { Tasks: 2, Planning: 1, Execution: 2, Learning: 2 };
  return <ProductShell activeItem={active} navigationItems={Object.keys(keys)} navigationLabel={name => `${t(keys[name])}${counts[name] ? ` (${counts[name]})` : ""}`} userLabel="Exercise coordinator" version="Preview">
    {active === "Overview" && <WorkOverview {...common} personId="reader"/>}
    {active === "Tasks" && <TasksPage {...common} personId="reader"/>}
    {active === "Planning" && <PlanningPage {...common} session={session}/>}
    {active === "Execution" && <ExecutionPage {...common} session={session}/>}
    {active === "Reports" && <ReportsPage {...common}/>}
  </ProductShell>;
}
createRoot(document.getElementById("root")).render(<LocalizationProvider language="en-US"><Preview/></LocalizationProvider>);
