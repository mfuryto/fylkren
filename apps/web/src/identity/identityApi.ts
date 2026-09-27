import { apiGet, apiMutate } from "../api/client";
import type { DirectoryIdentityLink, FederatedIdentityLink, GlobalUserPage, IdentityConfiguration } from "./models";

const root = "/api/platform/identity";
export const loadIdentityConfiguration = () => apiGet<IdentityConfiguration>(root, "Identitetskonfigurasjonen kunne ikke lastes.");
export const loadOidcLinks = () => apiGet<FederatedIdentityLink[]>(`${root}/oidc-links`, "OIDC-koblingene kunne ikke lastes.");
export const loadSamlLinks = () => apiGet<FederatedIdentityLink[]>(`${root}/saml-links`, "SAML-koblingene kunne ikke lastes.");
export const loadDirectoryLinks = () => apiGet<DirectoryIdentityLink[]>(`${root}/directory-links`, "Katalogkoblingene kunne ikke lastes.");
export const loadGlobalUsers = (page: number, pageSize: number, query: string, siteId: string) => {
  const parameters = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query.trim()) parameters.set("q", query.trim());
  if (siteId) parameters.set("siteId", siteId);
  return apiGet<GlobalUserPage>(`${root}/users?${parameters}`, "Den globale brukeroversikten kunne ikke lastes.");
};
export const addOidcIdentity = (body: object) => apiMutate(`${root}/oidc-links`, "POST", body, "OIDC-koblingen kunne ikke lagres. Kontroller brukernavn og unik subject-ID.");
export const addSamlIdentity = (body: object) => apiMutate(`${root}/saml-links`, "POST", body, "SAML-koblingen kunne ikke lagres. Kontroller brukernavn og unik persistent NameID.");
export const addDirectoryIdentity = (body: object) => apiMutate(`${root}/directory-links`, "POST", body, "Katalogkoblingen kunne ikke lagres. Kontroller lokal bruker, katalogbruker og katalogforbindelse.");
export const removeDirectoryIdentity = (id: string) => apiMutate(`${root}/directory-links/${id}`, "DELETE", undefined, "Katalogkoblingen kunne ikke fjernes.");
export const testDirectoryConnection = (provider: string) => apiMutate(`${root}/directories/${provider}/test`, "POST", undefined, `${provider === "ad" ? "Active Directory" : "LDAP"}-forbindelsen kunne ikke opprettes.`);
export const moveGlobalUser = (id: string, sourceSiteId: string, targetSiteId: string) => apiMutate(`${root}/users/${id}/move`, "POST", { sourceSiteId, targetSiteId }, "Brukeren kunne ikke flyttes.");
export type PasswordResetCode = { personId: string; displayName: string; resetCode: string; expiresAt: string };
export const resetGlobalPasswords = (personIds: string[]) => apiMutate<{ resetCodes: PasswordResetCode[] }>(`${root}/users/password`, "POST", { personIds }, "Engangskodene kunne ikke opprettes.");
export const assignGlobalUsers = (personIds: string[], siteId: string) => apiMutate(`${root}/users/assign`, "POST", { personIds, siteId }, "Brukerne kunne ikke tildeles siten.");
export const deleteGlobalUsers = (personIds: string[]) => apiMutate(`${root}/users/delete`, "POST", { personIds }, "Brukerne kunne ikke slettes.");
