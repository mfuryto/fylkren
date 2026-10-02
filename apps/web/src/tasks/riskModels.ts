export type Mitigation = { id: string; version: number; action: string; ownerPersonId: string; ownerNameSnapshot: string; status: string; dueDate: string | null };
export type Risk = { id: string; current: { version: number; title: string; description: string; probability: number; impact: number; score: number; level: string; ownerPersonId: string; ownerNameSnapshot: string; status: string; dueDate: string | null; residualProbability: number | null; residualImpact: number | null; residualScore: number | null; residualLevel: string | null }; mitigations: Mitigation[] };
export type RiskDraft = { title: string; description: string; probability: number; impact: number; status: string; dueDate: string; residualProbability: string; residualImpact: string; initialMitigation: string };
export const emptyRisk: RiskDraft = { title: "", description: "", probability: 1, impact: 1, status: "identified", dueDate: "", residualProbability: "", residualImpact: "", initialMitigation: "" };
export type Assessment = "before" | "after";
export const riskLevel = (probability: number, impact: number) => {
  const score = probability * impact;
  return score <= 4 ? "low" : score <= 9 ? "moderate" : score <= 16 ? "high" : "critical";
};
export function numberedRisks(risks: Risk[]): Risk[] {
  // The API returns newest first. Keep existing risk numbers stable when a risk is added.
  return [...risks].reverse();
}
