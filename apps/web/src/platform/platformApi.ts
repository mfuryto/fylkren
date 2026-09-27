import { apiGet, apiMutate } from "../api/client";
import type { ApiClient } from "./platformModels";

export function loadApiClients() {
  return apiGet<ApiClient[]>("/api/platform/api-clients/", "API-klientene kunne ikke lastes.");
}

export function createApiClient(input: { name: string; scopes: string[]; expiresAt: string }) {
  return apiMutate<{ name: string; token: string }>(
    "/api/platform/api-clients/",
    "POST",
    input,
    "API-klienten kunne ikke opprettes.",
  );
}

export function deactivateApiClient(id: string) {
  return apiMutate(`/api/platform/api-clients/${id}`, "DELETE", undefined, "API-klienten kunne ikke deaktiveres.");
}
