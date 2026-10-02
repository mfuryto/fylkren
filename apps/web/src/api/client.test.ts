import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGetCached, apiMutate, apiRequest, clearApiGetCache } from "./client";

afterEach(() => {
  clearApiGetCache();
  vi.unstubAllGlobals();
});

describe("apiGetCached", () => {
  it("shares a short-lived GET request between pages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = apiGetCached<{ value: number }>("context:user", "/api/work/context", "Error");
    const second = apiGetCached<{ value: number }>("context:user", "/api/work/context", "Error");

    await expect(Promise.all([first, second])).resolves.toEqual([{ value: 1 }, { value: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the cache and refreshes work counters after a successful mutation", async () => {
    const browserEvents = new EventTarget();
    const changed = vi.fn();
    browserEvents.addEventListener("fylkren:work-changed", changed);
    vi.stubGlobal("window", browserEvents);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === "string" ? input : input.toString();
      if (path === "/api/security/antiforgery") {
        return new Response(JSON.stringify({ token: "token" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (path === "/api/change") return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ value: fetchMock.mock.calls.length }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiGetCached("context:user", "/api/work/context", "Error");
    await apiMutate("/api/change", "POST", {}, "Error");
    await apiGetCached("context:user", "/api/work/context", "Error");

    expect(changed).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/work/context")).toHaveLength(2);
  });
});

describe("apiRequest", () => {
  it("uses one consistent JSON response format without overwriting other headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/example", "Error", { headers: { "X-Test": "retain" } });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Test")).toBe("retain");
  });

  it("shows a safe and specific problem reason from the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: { email: ["The email address is already in use."] },
    }), { status: 409, headers: { "Content-Type": "application/problem+json" } })));

    await expect(apiRequest("/api/example", "Handlingen feilet."))
      .rejects.toThrow("The email address is already in use.");
  });
});
