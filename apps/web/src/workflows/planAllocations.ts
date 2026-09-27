import type { PlanAllocation } from "./PlanningModels";

export function addPlanAllocation(allocations: PlanAllocation[], stepId: string, unitId: string, instruction: string): PlanAllocation[] {
  const text = instruction.trim();
  if (!unitId || !text || text.length > 10000) throw new Error("Velg en mottaker og skriv en oppdragstekst på høyst 10 000 tegn.");
  if (allocations.some(allocation => allocation.stepId === stepId && allocation.unitId === unitId)) {
    throw new Error("Enheten har allerede et deloppdrag i dette plansteget. Rediger oppgavelisten ovenfor.");
  }
  return [...allocations, { stepId, unitId, instruction: text }];
}
