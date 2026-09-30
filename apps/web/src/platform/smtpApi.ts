import { apiGet, apiMutate } from "../api/client";
import type { NotificationDeliveryPage, NotificationTemplate, SmtpConfiguration } from "./platformModels";
import { translateActive as t } from "../localization";

export function loadSmtpConfiguration() {
  return apiGet<SmtpConfiguration>("/api/platform/smtp/", t("emailSetupLoadFailed"));
}

export function saveSmtpConfiguration(configuration: SmtpConfiguration, password: string, clearPassword: boolean) {
  return apiMutate(
    "/api/platform/smtp/",
    "PUT",
    { ...configuration, password: password || null, clearPassword },
    t("smtpSaveFailed"),
  );
}

export function sendSmtpTest(recipient: string) {
  return apiMutate("/api/platform/smtp/test", "POST", { recipient }, t("testMessageSendFailed"));
}

export function loadNotificationTemplates() {
  return apiGet<NotificationTemplate[]>("/api/platform/smtp/templates", t("templatesLoadFailed"));
}

export function saveNotificationTemplate(template: NotificationTemplate) {
  return apiMutate(
    `/api/platform/smtp/templates/${template.key}`,
    "PUT",
    { subject: template.subject, body: template.body },
    t("templateSaveFailed"),
  );
}

export function loadNotificationDeliveries(status: string, page: number) {
  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (status) query.set("status", status);
  return apiGet<NotificationDeliveryPage>(
    `/api/platform/smtp/deliveries?${query}`,
    t("emailDeliveryStatusLoadFailed"),
  );
}
