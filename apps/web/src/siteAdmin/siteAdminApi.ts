import { apiGet, apiMutate } from "../api/client";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { AccessSummary, DirectoryProviderSummary, DirectoryUserSummary, ExistingUserSummary, OrganizationUnitSummary, PersonSummary, PlacementOption, SiteSummary } from "./models";

export const loadSites = (init?: RequestInit) => apiGet<SiteSummary[]>("/api/sites", "Sites kunne ikke lastes.", init);
export const loadPlacementOptions = () => apiGet<PlacementOption[]>("/api/site-placement-options", "Plasseringsvalgene kunne ikke lastes.");
export const searchSitePeople = (siteId: string, query: string) => apiGet<PersonSummary[]>(`/api/people?${new URLSearchParams({ siteId, q: query })}`, "Brukersøket kunne ikke fullføres.");
export const loadWorkContext = (init?: RequestInit) => apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", "Arbeidskonteksten kunne ikke lastes.", init);
export const loadOrganizationUnits = (siteId: string, init?: RequestInit) => apiGet<OrganizationUnitSummary[]>(`/api/sites/${siteId}/organization-units`, "Organisasjonsenhetene kunne ikke lastes.", init);
export const loadSiteAccess = (siteId: string) => apiGet<AccessSummary>(`/api/sites/${siteId}/access`, "Personelldata kunne ikke lastes.");
export const mutateSiteAccess = <T = void>(siteId: string, path: string, method: "POST" | "PUT" | "DELETE", body?: object) => apiMutate<T>(`/api/sites/${siteId}/access/${path}`, method, body, "Handlingen kunne ikke utføres.");
export const loadDirectoryProviders = (siteId: string) => apiGet<DirectoryProviderSummary[]>(`/api/sites/${siteId}/access/directory-providers`, "Katalogleverandørene kunne ikke lastes.");
export const searchDirectoryUsers = (siteId: string, provider: string, query: string) => apiGet<DirectoryUserSummary[]>(`/api/sites/${siteId}/access/directory-users?${new URLSearchParams({ provider, q: query })}`, "Katalogsøket kunne ikke fullføres.");
export const searchExistingUsers = (siteId: string, query: string) => apiGet<ExistingUserSummary[]>(`/api/sites/${siteId}/access/existing-local-users?q=${encodeURIComponent(query)}`, "Søket etter eksisterende brukere kunne ikke fullføres.");
