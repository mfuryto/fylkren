import { apiGet, apiMutate } from "../api/client";
import { translateActive as t } from "../localization";

export type LessonKind = "positive" | "improvement";
export type LessonStatus = "new" | "in_progress" | "implemented" | "dismissed";
export type LessonPriority = "high" | "normal" | "low";
export type LessonDraft = { id: string; kind: LessonKind; text: string };
export type Lesson = {
  id: string; siteId: string; unitId: string; workItemId: string; number: number; kind: LessonKind; text: string;
  authorName: string; createdAt: string; updatedAt: string; status: LessonStatus; priority: LessonPriority;
  actionPlan: string; treatmentNote: string; dueOn: string | null; ownerName: string | null; version: number;
  canManage: boolean; workReference: string; workTitle: string;
};
export type LearningLevel = { siteId: string; siteName: string; unitId: string; unitName: string; canManage: boolean };
export type LearningPage = { items: Lesson[]; levels: LearningLevel[]; total: number; page: number; totalPages: number };
export type LearningEntry = { id: string; authorName: string; kind: "comment" | "review"; text: string; createdAt: string; status: LessonStatus | null; priority: LessonPriority | null; actionPlan: string | null; dueOn: string | null };
export type EntryPage = { items: LearningEntry[]; total: number; page: number; totalPages: number };
export type LessonReview = Pick<Lesson, "version" | "status" | "priority" | "actionPlan" | "treatmentNote" | "dueOn">;
export const getLearning = (query: URLSearchParams, signal?: AbortSignal) => apiGet<LearningPage>(`/api/work/learning?${query}`, t("learningLoadFailed"), { signal });
export const getLearningEntries = (id: string, page = 1) => apiGet<EntryPage>(`/api/work/learning/${id}/entries?page=${page}`, t("learningLoadFailed"));
export const commentLearning = (id: string, text: string) => apiMutate(`/api/work/learning/${id}/comments`, "POST", { text }, t("learningSaveFailed"));
export const reviewLearning = (id: string, body: LessonReview) => apiMutate(`/api/work/learning/${id}/review`, "PUT", body, t("learningSaveFailed"));
