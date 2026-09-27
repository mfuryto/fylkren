import { responseErrorMessage } from "./errors";

const getCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

export function clearApiGetCache() {
  getCache.clear();
}

export async function apiRequest(path: string, fallback: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
  return response;
}

export async function getAntiforgeryToken() {
  const response = await apiRequest("/api/security/antiforgery", "Sikkerhetstoken kunne ikke hentes.");
  return ((await response.json()) as { token: string }).token;
}

export async function apiGet<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, fallback, init);
  return response.json() as Promise<T>;
}

export function apiGetCached<T>(cacheKey: string, path: string, fallback: string, ttlMs = 60_000): Promise<T> {
  const existing = getCache.get(cacheKey);
  if (existing && existing.expiresAt > Date.now()) return existing.promise as Promise<T>;
  const promise = apiGet<T>(path, fallback);
  const entry = { expiresAt: Date.now() + ttlMs, promise };
  getCache.set(cacheKey, entry);
  void promise.catch(() => { if (getCache.get(cacheKey) === entry) getCache.delete(cacheKey); });
  return promise;
}

export async function apiMutate<T = void>(path: string, method: "POST" | "PUT" | "DELETE", body: object | undefined, fallback: string): Promise<T> {
  const token = await getAntiforgeryToken();
  const response = await apiRequest(path, fallback, {
    method,
    headers: { "X-Fylkren-CSRF": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  clearApiGetCache();
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() as Promise<T> : undefined as T;
}

export async function apiFormMutate<T = void>(path: string, method: "POST" | "PUT", body: FormData, fallback: string): Promise<T> {
  const token = await getAntiforgeryToken();
  const response = await apiRequest(path, fallback, {
    method,
    headers: { "X-Fylkren-CSRF": token },
    body,
  });
  clearApiGetCache();
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() as Promise<T> : undefined as T;
}
