import { apiGet } from "../api/client";
import { translateActive } from "../localization";

export type AuditSite = { id: string; name: string };
export type SiteAuditRow = { id: string; occurredAt: string; eventType: string; entityType: string; entityId: string; entityName: string | null; actor: string };
export type SiteAuditPage = { events: SiteAuditRow[]; eventTypes: string[]; page: number; totalPages: number; total: number };
export type SiteAuditFilters = { area: string; eventType: string; from: string; to: string; search: string; sort: string };

export const loadAuditSites = () => apiGet<AuditSite[]>("/api/site-audit/sites", translateActive("notificationSitesLoadFailed"));
export const loadSiteAudit = (siteId: string, page: number, filters: SiteAuditFilters) => {
  const query = new URLSearchParams({ page: String(page) });
  if (filters.area) query.set("area", filters.area);
  if (filters.eventType) query.set("eventType", filters.eventType);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.search.trim()) query.set("search", filters.search.trim());
  query.set("sort", filters.sort);
  return apiGet<SiteAuditPage>(`/api/site-audit/sites/${siteId}?${query}`, translateActive("auditLogLoadFailed"));
};
