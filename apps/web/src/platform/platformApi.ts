import { apiGet, apiMutate } from "../api/client";
import { translateActive } from "../localization";
import type { ApiClient } from "./platformModels";

export function loadApiClients() {
  return apiGet<ApiClient[]>("/api/platform/api-clients/", translateActive("apiClientsLoadFailed"));
}

export function createApiClient(input: { name: string; scopes: string[]; expiresAt: string }) {
  return apiMutate<{ name: string; privateKey: string }>(
    "/api/platform/api-clients/",
    "POST",
    input,
    translateActive("apiClientCreateFailed"),
  );
}

export function deactivateApiClient(id: string) {
  return apiMutate(`/api/platform/api-clients/${id}`, "DELETE", undefined, translateActive("apiClientDeactivateFailed"));
}
