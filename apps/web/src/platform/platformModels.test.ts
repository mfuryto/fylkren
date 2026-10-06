import { describe, expect, it } from "vitest";
import { apiClientExpiryDate, apiClientScopes, filterApiClients, notificationTemplateFields, type ApiClient } from "./platformModels";

const clients: ApiClient[] = [
  { id: "1", name: "Active", keyId: "a", authenticationMode: "signed-v2", legacyBearerAcceptedUntil: null, scopes: [], expiresAt: null, createdAt: "2026-01-01", lastUsedAt: null, isActive: true },
  { id: "2", name: "Inactive", keyId: "b", authenticationMode: "bearer-v1", legacyBearerAcceptedUntil: "2027-01-04", scopes: [], expiresAt: null, createdAt: "2026-01-01", lastUsedAt: null, isActive: false },
];

describe("platform models", () => {
  it("shows active API clients by default and supports explicit filters", () => {
    expect(filterApiClients(clients, "active").map(item => item.id)).toEqual(["1"]);
    expect(filterApiClients(clients, "inactive").map(item => item.id)).toEqual(["2"]);
    expect(filterApiClients(clients, "all")).toHaveLength(2);
  });

  it("keeps API scopes unique and notification fields scoped by event", () => {
    expect(new Set(apiClientScopes.map(scope => scope.key)).size).toBe(apiClientScopes.length);
    expect(notificationTemplateFields["new-work-item"]).toContain("deadline");
    expect(notificationTemplateFields["planning-completed"]).not.toContain("deadline");
  });

  it("provides a valid default expiry for new API clients", () => {
    expect(apiClientExpiryDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${apiClientExpiryDate()}T23:59:59Z`).getTime()).toBeGreaterThan(Date.now());
  });
});
