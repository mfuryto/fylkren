import { apiGet, apiMutate } from "../api/client";
import type { NotificationDeliveryPage, NotificationTemplate, SmtpConfiguration } from "./platformModels";

export function loadSmtpConfiguration() {
  return apiGet<SmtpConfiguration>("/api/platform/smtp/", "E-postoppsettet kunne ikke lastes.");
}

export function saveSmtpConfiguration(configuration: SmtpConfiguration, password: string, clearPassword: boolean) {
  return apiMutate(
    "/api/platform/smtp/",
    "PUT",
    { ...configuration, password: password || null, clearPassword },
    "SMTP-oppsettet kunne ikke lagres.",
  );
}

export function sendSmtpTest(recipient: string) {
  return apiMutate("/api/platform/smtp/test", "POST", { recipient }, "Testmeldingen kunne ikke sendes.");
}

export function loadNotificationTemplates() {
  return apiGet<NotificationTemplate[]>("/api/platform/smtp/templates", "Varslingsmalene kunne ikke lastes.");
}

export function saveNotificationTemplate(template: NotificationTemplate) {
  return apiMutate(
    `/api/platform/smtp/templates/${template.key}`,
    "PUT",
    { subject: template.subject, body: template.body },
    "Varslingsmalen kunne ikke lagres.",
  );
}

export function loadNotificationDeliveries(status: string, page: number) {
  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (status) query.set("status", status);
  return apiGet<NotificationDeliveryPage>(
    `/api/platform/smtp/deliveries?${query}`,
    "Leveringsstatus for e-postvarsler kunne ikke lastes.",
  );
}
