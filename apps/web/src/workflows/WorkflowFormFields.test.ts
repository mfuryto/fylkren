import { describe, expect, it } from "vitest";
import type { TaskUnit } from "../work/WorkContextModels";
import { emptyWorkflowForm, type WorkflowTemplateSummary } from "./WorkflowModels";
import { isWorkflowTemplateApplicable, workflowStepNames } from "./WorkflowFormFields";

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Enhet", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: true, ...values,
});
const template = (ownerUnitId: string | null): WorkflowTemplateSummary => ({
  id: "template", name: "Mal", content: "", ownerUnitId, ownerUnitName: null, canEdit: true,
});

describe("WorkflowFormFields", () => {
  it("normaliserer tomme linjer i stegnavn", () => {
    expect(workflowStepNames(" Analyse \n\n Plan \n")).toEqual(["Analyse", "Plan"]);
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
