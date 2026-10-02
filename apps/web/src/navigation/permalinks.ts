export const appPages = [
  "Overview", "Tasks", "Workload", "Learning", "Planning", "Execution", "Reports", "Profile",
  "Platform", "Sites", "Identity", "References", "Classifications", "API", "Federation", "License",
  "Email", "Appearance", "Organization", "Personnel", "Sources", "Workflows", "Templates",
  "Notifications", "Audit",
] as const;

export type AppPage = (typeof appPages)[number];

const pagePaths: Record<AppPage, string> = {
  Overview: "overview", Tasks: "tasks", Workload: "workload", Learning: "learning", Planning: "planning",
  Execution: "execution", Reports: "reports", Profile: "profile", Platform: "platform",
  Sites: "sites", Identity: "identity", References: "references", Classifications: "classifications", API: "api",
  Federation: "federation", License: "license", Email: "email", Appearance: "appearance",
  Organization: "organization", Personnel: "personnel", Sources: "sources", Workflows: "workflows",
  Templates: "templates", Notifications: "notifications", Audit: "audit",
};

const pagesByPath: Record<string, AppPage> = {
  ...Object.fromEntries(Object.entries(pagePaths).map(([page, path]) => [path, page as AppPage])),
};

export type AppLocation = { page: AppPage; siteId?: string; unitId?: string; itemId?: string; runId?: string; reportId?: string; year?: string; taskFilter?: string; taskSearch?: string };

export function parseAppLocation(hash: string): AppLocation {
  const raw = hash.replace(/^#\/?/, "");
  const [path = "", query = ""] = raw.split("?", 2);
  const parameters = new URLSearchParams(query);
  const identifier = (key: string) => {
    const value = parameters.get(key);
    return value && /^[A-Za-z0-9-]+$/.test(value) ? value : undefined;
  };
  return {
    page: pagesByPath[path.toLocaleLowerCase()] ?? "Overview",
    siteId: identifier("site"),
    unitId: identifier("unit"),
    itemId: identifier("item"),
    runId: identifier("run"),
    reportId: identifier("report"),
    year: parameters.get("year") ?? undefined,
    taskFilter: parameters.get("view") ?? undefined,
    taskSearch: parameters.get("q") ?? undefined,
  };
}

export function buildAppHash(location: AppLocation) {
  const parameters = new URLSearchParams();
  if (location.siteId) parameters.set("site", location.siteId);
  if (location.unitId) parameters.set("unit", location.unitId);
  if (location.itemId) parameters.set("item", location.itemId);
  if (location.runId) parameters.set("run", location.runId);
  if (location.reportId) parameters.set("report", location.reportId);
  if (location.year) parameters.set("year", location.year);
  if (location.taskFilter) parameters.set("view", location.taskFilter);
  if (location.taskSearch) parameters.set("q", location.taskSearch);
  const query = parameters.toString();
  return `#/${pagePaths[location.page]}${query ? `?${query}` : ""}`;
}

export function currentAppLocation() {
  return parseAppLocation(window.location.hash);
}

export function navigateToLocation(location: AppLocation, replace = false) {
  const url = `${window.location.pathname}${window.location.search}${buildAppHash(location)}`;
  window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function copyPermalink(location: AppLocation) {
  return navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${buildAppHash(location)}`);
}
