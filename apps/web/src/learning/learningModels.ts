import type { MessageKey } from "../localization";
import type { LessonPriority, LessonReview, LessonStatus } from "./learningApi";

export const lessonStatusKeys: Record<LessonStatus, MessageKey> = {
  new: "learningNew", in_progress: "learningInProgress", implemented: "learningImplemented", dismissed: "learningDismissed",
};
export const lessonPriorityKeys: Record<LessonPriority, MessageKey> = { high: "priorityHigh", normal: "priorityNormal", low: "priorityLow" };
export function validLessonReview(review: LessonReview, previousStatus: LessonStatus, previousNote = "") {
  if (review.actionPlan.trim().length > 2000 || review.treatmentNote.trim().length > 4000) return false;
  if (review.status === "in_progress" && (review.actionPlan.trim().length < 2 || !review.dueOn)) return false;
  if (["implemented", "dismissed"].includes(review.status) && review.treatmentNote.trim().length < 2) return false;
  if (["implemented", "dismissed"].includes(previousStatus) && ["new", "in_progress"].includes(review.status) && (review.treatmentNote.trim().length < 2 || review.treatmentNote.trim() === previousNote.trim())) return false;
  return true;
}
