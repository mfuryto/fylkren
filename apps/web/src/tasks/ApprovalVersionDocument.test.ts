import { describe, expect, it } from "vitest";
import { approvalSections } from "./ApprovalVersionDocument";

describe("approvalSections", () => {
  it("presents an approved plan as readable steps and allocations", () => {
    const sections = approvalSections({ objectType: "plan", content: {
      task: { title: "Empty the tank", description: "Remove the water" },
      plan: { proposedPriority: "high" },
      steps: [{ id: "step-1", name: "Analysis" }],
      documents: [{ stepId: "step-1", content: "<p>Assess risk</p>" }],
      allocations: [{ stepId: "step-1", unitId: "unit-1", unit: "Section 1", instruction: "Bring buckets" }],
      requests: [{ stepId: "step-1", targetSiteId: "site-2", targetSite: "Department X", instruction: "Provide a tanker" }],
    } });
    expect(sections.map(value => value.title)).toEqual(["Oppdrag", "Planbeslutning", "Analysis", "Oppgaver til underenheter", "Anmodninger"]);
    expect(sections.find(value => value.key === "plan")?.fields[0].value).toBe("Høy");
    expect(sections.find(value => value.key === "allocations")?.fields[0]).toMatchObject({ label: "Section 1", value: "Bring buckets" });
  });

  it("presents approved reports and decisions without requiring raw JSON", () => {
    const report = approvalSections({ objectType: "final_report", content: { task: { title: "Task" }, report: { content: "<p>Completed</p>", classification: "CONFIDENTIAL" } } });
    expect(report.find(value => value.key === "report")?.fields.map(value => value.label)).toEqual(["Rapport", "Klassifisering"]);
    const decision = approvalSections({ objectType: "decision", content: { title: "Start", decision: "Proceed", rationale: "Plan approved", decisionMakers: [{ displayName: "Test Leader" }] } });
    expect(decision[0].fields.find(value => value.key === "makers")?.value).toBe("Test Leader");
  });
});
