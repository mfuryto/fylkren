import { describe, expect, it } from "vitest";
import type { TaskUnit } from "../work/WorkContextModels";
import { emptyWorkflowForm, type WorkflowTemplateSummary } from "./WorkflowModels";
import { isWorkflowTemplateApplicable, workflowStepNames } from "./WorkflowFormFields";

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Unit", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: true, ...values,
});
const template = (ownerUnitId: string | null): WorkflowTemplateSummary => ({
  id: "template", name: "Template", content: "", ownerUnitId, ownerUnitName: null, canEdit: true,
});

describe("WorkflowFormFields", () => {
  it("normalizes blank lines in step names", () => {
    expect(workflowStepNames(" Analysis \n\n Plan \n")).toEqual(["Analysis", "Plan"]);
  });

  it("allows execution to use templates from its own and parent levels", () => {
    const form = { ...emptyWorkflowForm(), ownerUnitId: "team" };
    const units = [unit({ id: "section" }), unit({ id: "team", parentId: "section" })];
    expect(isWorkflowTemplateApplicable(template(null), form, units)).toBe(true);
    expect(isWorkflowTemplateApplicable(template("section"), form, units)).toBe(true);
    expect(isWorkflowTemplateApplicable(template("other"), form, units)).toBe(false);
  });

  it("limits planning to site-wide templates", () => {
    const form = { ...emptyWorkflowForm(), kind: "planning" as const, ownerUnitId: "team" };
    expect(isWorkflowTemplateApplicable(template("team"), form, [unit({ id: "team" })])).toBe(false);
  });
});
