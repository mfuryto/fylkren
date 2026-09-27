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

export const notificationTemplateNames: Record<string, string> = {
  "new-work-item": "Nytt oppdrag",
  "work-item-changed": "Oppdrag endret",
  "decision-required": "Handling kreves",
  "child-work-completed": "Deloppdrag eller sluttrapport fullført",
  "planning-completed": "Plan ferdig",
  "execution-completed": "Utførelse ferdig",
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

export const notificationTemplateFieldDescriptions: Record<string, string> = {
  recipientName: "mottakerens visningsnavn",
  siteName: "aktuell site",
  levelName: "aktuelt arbeidsnivå",
  title: "oppdragets tittel",
  taskType: "oppgavetype",
  priority: "prioritet",
  status: "gjeldende status",
  deadline: "frist i installasjonens tidssone",
  actionRequired: "handlingen mottakeren må utføre",
  actorName: "personen som utløste hendelsen",
  reportingUnit: "enheten som leverte",
  link: "direkte lenke til riktig visning",
  classification: "full klassifiseringsbetegnelse",
};

export const apiClientScopes = [
  { key: "sites:read", label: "Lese sites" },
  { key: "sites:write", label: "Opprette og redigere sites" },
  { key: "sites:move", label: "Flytte sites" },
  { key: "sites:deactivate", label: "Deaktivere sites" },
  { key: "users:read", label: "Søke og lese brukere" },
  { key: "users:assign", label: "Tildele brukere til site" },
  { key: "users:move", label: "Flytte brukere mellom sites" },
  { key: "users:deactivate", label: "Deaktivere brukere uten aktiv site" },
  { key: "classifications:read", label: "Lese klassifiseringer" },
  { key: "classifications:write", label: "Forvalte klassifiseringer og aktivering" },
  { key: "reports:read", label: "Lese godkjente rapporter etter separat site- og nivåtildeling" },
] as const;

export function filterApiClients(clients: ApiClient[], filter: ApiClientStatusFilter) {
  return clients.filter(client => filter === "all" || client.isActive === (filter === "active"));
}

export function apiClientExpiryDate(days = 90) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatPlatformDateTime(value: string | null, language: string, timeZone: string) {
  return value ? new Date(value).toLocaleString(language, { timeZone }) : "Aldri";
}
