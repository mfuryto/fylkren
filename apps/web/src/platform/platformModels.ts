export type ClassificationRow = {
  id: string;
  name: string;
  abbreviation: string;
  sortOrder: number;
  isActive: boolean;
};

export type SmtpConfiguration = {
  enabled: boolean;
  host: string;
  port: number;
  security: "starttls" | "none";
  username: string | null;
  hasPassword: boolean;
  fromAddress: string;
  fromName: string;
  lastTestedAt: string | null;
  lastTestSucceeded: boolean | null;
  lastTestError: string | null;
};

export type NotificationTemplate = { key: string; subject: string; body: string };

export type NotificationDelivery = {
  id: string;
  siteId: string;
  siteName: string | null;
  workItemId: string;
  workItemTitle: string | null;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  nextAttemptAt: string;
  sentAt: string | null;
  lastError: string | null;
};

export type NotificationDeliveryPage = {
  transportEnabled: boolean;
  lastProjectedAt: string;
  projectionBacklog: number;
  pending: number;
  failed: number;
  items: NotificationDelivery[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiClient = {
  id: string;
  name: string;
  keyId: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
};

export type ApiClientStatusFilter = "active" | "inactive" | "all";

export const notificationTemplateNameKeys: Record<string, MessageKey> = {
  "new-work-item": "templateNewWork",
  "work-item-changed": "templateWorkChanged",
  "decision-required": "templateDecisionRequired",
  "child-work-completed": "templateChildCompleted",
  "planning-completed": "templatePlanningCompleted",
  "execution-completed": "templateExecutionCompleted",
};

export const commonNotificationTemplateFields = [
  "recipientName", "siteName", "levelName", "title", "actionRequired", "link", "classification",
];

export const notificationTemplateFields: Record<string, string[]> = {
  "new-work-item": [...commonNotificationTemplateFields, "taskType", "priority", "deadline"],
  "work-item-changed": [...commonNotificationTemplateFields, "status", "priority", "deadline", "actorName"],
  "decision-required": [...commonNotificationTemplateFields, "status", "actorName"],
  "child-work-completed": [...commonNotificationTemplateFields, "status", "reportingUnit"],
  "planning-completed": [...commonNotificationTemplateFields, "reportingUnit"],
  "execution-completed": [...commonNotificationTemplateFields, "status", "reportingUnit"],
};

export const notificationTemplateFieldDescriptionKeys: Record<string, MessageKey> = {
  recipientName: "fieldRecipientName",
  siteName: "fieldSiteName",
  levelName: "fieldLevelName",
  title: "fieldTitle",
  taskType: "fieldTaskType",
  priority: "fieldPriority",
  status: "fieldStatus",
  deadline: "fieldDeadline",
  actionRequired: "fieldActionRequired",
  actorName: "fieldActorName",
  reportingUnit: "fieldReportingUnit",
  link: "fieldLink",
  classification: "fieldClassification",
};

export const apiClientScopes = [
  { key: "sites:read", labelKey: "scopeSitesRead" },
  { key: "sites:write", labelKey: "scopeSitesWrite" },
  { key: "sites:move", labelKey: "scopeSitesMove" },
  { key: "sites:deactivate", labelKey: "scopeSitesDeactivate" },
  { key: "users:read", labelKey: "scopeUsersRead" },
  { key: "users:assign", labelKey: "scopeUsersAssign" },
  { key: "users:move", labelKey: "scopeUsersMove" },
  { key: "users:deactivate", labelKey: "scopeUsersDeactivate" },
  { key: "classifications:read", labelKey: "scopeClassificationsRead" },
  { key: "classifications:write", labelKey: "scopeClassificationsWrite" },
  { key: "reports:read", labelKey: "scopeReportsRead" },
] as const;

export function filterApiClients(clients: ApiClient[], filter: ApiClientStatusFilter) {
  return clients.filter(client => filter === "all" || client.isActive === (filter === "active"));
}

export function apiClientExpiryDate(days = 90) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatPlatformDateTime(value: string | null, language: string, timeZone: string, emptyValue = "Never") {
  return value ? new Date(value).toLocaleString(language, { timeZone }) : emptyValue;
}
import type { MessageKey } from "../localization/en";
