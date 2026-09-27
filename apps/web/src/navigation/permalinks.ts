const pagePaths: Record<string, string> = {
  Oversikt: "overview", Oppgaver: "tasks", Belastning: "workload", Planlegging: "planning",
  Utførelse: "execution", Rapporter: "reports", Profil: "profile", Plattform: "platform",
  Sites: "sites", Identitet: "identity", Klassifisering: "classifications", API: "api", Federering: "federation", Lisens: "license",
  "E-post": "email", Utseende: "appearance", Organisasjon: "organization", Personell: "personnel",
  Arbeidsflyter: "workflows", Maler: "templates", Varslinger: "notifications", Revisjon: "audit",
};

const pagesByPath: Record<string, string> = {
  ...Object.fromEntries(Object.entries(pagePaths).map(([page, path]) => [path, page])),
  oversikt: "Oversikt", oppgaver: "Oppgaver", belastning: "Belastning", planlegging: "Planlegging",
  utforelse: "Utførelse", rapporter: "Rapporter", profil: "Profil", plattform: "Plattform",
  identitet: "Identitet", klassifisering: "Klassifisering", "e-post": "E-post", utseende: "Utseende",
  organisasjon: "Organisasjon", personell: "Personell", arbeidsflyter: "Arbeidsflyter",
  maler: "Maler", varslinger: "Varslinger", revisjon: "Revisjon",
};

export type AppLocation = { page: string; siteId?: string; unitId?: string; itemId?: string; runId?: string; reportId?: string; year?: string; taskFilter?: string; taskSearch?: string };

export function parseAppLocation(hash: string): AppLocation {
  const raw = hash.replace(/^#\/?/, "");
  const [path = "", query = ""] = raw.split("?", 2);
  const parameters = new URLSearchParams(query);
  return {
    page: pagesByPath[path.toLocaleLowerCase()] ?? "Oversikt",
    siteId: parameters.get("site") ?? undefined,
    unitId: parameters.get("unit") ?? undefined,
    itemId: parameters.get("item") ?? undefined,
    runId: parameters.get("run") ?? undefined,
    reportId: parameters.get("report") ?? undefined,
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
  return `#/${pagePaths[location.page] ?? pagePaths.Oversikt}${query ? `?${query}` : ""}`;
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
