import { describe, expect, it } from "vitest";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { defaultTemplateOwnerUnitId, emptyTemplateForm } from "./TemplateModels";

const site = (values: Partial<TaskSite> = {}): TaskSite => ({
  siteId: "site", name: "Site", isSiteManager: false, isTopLevelLeader: false,
  hasTopLevelAccess: false, isManager: false, ...values,
});
const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Enhet", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: false, ...values,
});

describe("TemplateModels", () => {
  it("bruker lederens nivå som standard for en lokal mal", () => {
    expect(defaultTemplateOwnerUnitId(site(), [unit({ id: "member" }), unit({ id: "leader", isLeader: true })])).toBe("leader");
  });

  it("lar Site Manager opprette site-felles mal", () => {
    expect(defaultTemplateOwnerUnitId(site({ isSiteManager: true }), [unit({ id: "leader", isLeader: true })])).toBe("");
    expect(defaultTemplateOwnerUnitId(site({ isTopLevelLeader: true }), [unit({ id: "leader", isLeader: true })])).toBe("leader");
    expect(emptyTemplateForm()).toEqual({ id: "", name: "", content: "", ownerUnitId: "" });
  });
});
