import { describe, expect, it } from "vitest";
import { validLessonReview } from "./learningModels";
import type { LessonReview } from "./learningApi";

const draft: LessonReview = { version: 1, status: "new", priority: "normal", actionPlan: "", treatmentNote: "", dueOn: null };
describe("learning treatment", () => {
  it("allows prioritizing a new point before treatment", () => {
    expect(validLessonReview({ ...draft, priority: "high" }, "new")).toBe(true);
  });
  it("requires both a concrete plan and a deadline for work in progress", () => {
    expect(validLessonReview({ ...draft, status: "in_progress", actionPlan: "Standardize the useful practice" }, "new")).toBe(false);
    expect(validLessonReview({ ...draft, status: "in_progress", dueOn: "2026-11-01" }, "new")).toBe(false);
    expect(validLessonReview({ ...draft, status: "in_progress", actionPlan: "Standardize the useful practice", dueOn: "2026-11-01" }, "new")).toBe(true);
  });
  it("requires a recorded outcome for both implemented and dismissed points", () => {
    for (const status of ["implemented", "dismissed"] as const) {
      expect(validLessonReview({ ...draft, status }, "in_progress")).toBe(false);
      expect(validLessonReview({ ...draft, status, treatmentNote: "Documented outcome" }, "in_progress")).toBe(true);
    }
  });
  it("requires a fresh rationale when a closed point is reopened", () => {
    expect(validLessonReview(draft, "dismissed", "Original outcome")).toBe(false);
    expect(validLessonReview({ ...draft, treatmentNote: "Original outcome" }, "dismissed", "Original outcome")).toBe(false);
    expect(validLessonReview({ ...draft, treatmentNote: "New evidence warrants reconsideration" }, "dismissed", "Original outcome")).toBe(true);
  });
});
