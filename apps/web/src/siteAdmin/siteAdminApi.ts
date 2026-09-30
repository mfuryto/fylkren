import { apiGet, apiMutate } from "../api/client";
import { translateActive } from "../localization";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { AccessSummary, DirectoryProviderSummary, DirectoryUserSummary, ExistingUserSummary, OrganizationUnitSummary, PersonSummary, PlacementOption, SiteSummary } from "./models";

export const loadSites = (init?: RequestInit) => apiGet<SiteSummary[]>("/api/sites", translateActive("sitesLoadFailed"), init);
export const loadPlacementOptions = () => apiGet<PlacementOption[]>("/api/site-placement-options", translateActive("placementOptionsLoadFailed"));
export const searchSitePeople = (siteId: string, query: string) => apiGet<PersonSummary[]>(`/api/people?${new URLSearchParams({ siteId, q: query })}`, translateActive("peopleSearchFailed"));
export const loadWorkContext = (init?: RequestInit) => apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", translateActive("workContextLoadFailed"), init);
export const loadOrganizationUnits = (siteId: string, init?: RequestInit) => apiGet<OrganizationUnitSummary[]>(`/api/sites/${siteId}/organization-units`, translateActive("organizationUnitsLoadFailed"), init);
export const loadSiteAccess = (siteId: string) => apiGet<AccessSummary>(`/api/sites/${siteId}/access`, translateActive("personnelLoadFailed"));
export const mutateSiteAccess = <T = void>(siteId: string, path: string, method: "POST" | "PUT" | "DELETE", body?: object) => apiMutate<T>(`/api/sites/${siteId}/access/${path}`, method, body, translateActive("siteActionFailed"));
export const loadDirectoryProviders = (siteId: string) => apiGet<DirectoryProviderSummary[]>(`/api/sites/${siteId}/access/directory-providers`, translateActive("directoryProvidersLoadFailed"));
export const searchDirectoryUsers = (siteId: string, provider: string, query: string) => apiGet<DirectoryUserSummary[]>(`/api/sites/${siteId}/access/directory-users?${new URLSearchParams({ provider, q: query })}`, translateActive("directorySearchFailed"));
export const searchExistingUsers = (siteId: string, query: string) => apiGet<ExistingUserSummary[]>(`/api/sites/${siteId}/access/existing-local-users?q=${encodeURIComponent(query)}`, translateActive("existingUsersSearchFailed"));
