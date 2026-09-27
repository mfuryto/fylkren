import { describe, expect, it } from "vitest";
import { approvalSections } from "./ApprovalVersionDocument";

describe("approvalSections", () => {
  it("presents an approved plan as readable steps and allocations", () => {
    const sections = approvalSections({ objectType: "plan", content: {
      task: { title: "Tøm tanken", description: "Fjern vannet" },
      plan: { proposedPriority: "high" },
      steps: [{ id: "step-1", name: "Analyse" }],
      documents: [{ stepId: "step-1", content: "<p>Vurder risiko</p>" }],
      allocations: [{ stepId: "step-1", unitId: "unit-1", unit: "Seksjon 1", instruction: "Ta med bøtter" }],
      requests: [{ stepId: "step-1", targetSiteId: "site-2", targetSite: "Avdeling X", instruction: "Still med tankbil" }],
    } });
    expect(sections.map(value => value.title)).toEqual(["Oppdrag", "Planbeslutning", "Analyse", "Oppgaver til underenheter", "Anmodninger"]);
    expect(sections.find(value => value.key === "plan")?.fields[0].value).toBe("Høy");
    expect(sections.find(value => value.key === "allocations")?.fields[0]).toMatchObject({ label: "Seksjon 1", value: "Ta med bøtter" });
  });

  it("presents approved reports and decisions without requiring raw JSON", () => {
    const report = approvalSections({ objectType: "final_report", content: { task: { title: "Oppdrag" }, report: { content: "<p>Utført</p>", classification: "TJENSTLIG" } } });
    expect(report.find(value => value.key === "report")?.fields.map(value => value.label)).toEqual(["Rapport", "Klassifisering"]);
    const decision = approvalSections({ objectType: "decision", content: { title: "Iverksett", decision: "Gjennomfør", rationale: "Plan godkjent", decisionMakers: [{ displayName: "Test Leder" }] } });
    expect(decision[0].fields.find(value => value.key === "makers")?.value).toBe("Test Leder");
  });
});
