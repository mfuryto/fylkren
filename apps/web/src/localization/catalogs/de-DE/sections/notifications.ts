import type { MessageKey } from "../../en-US";

export const notificationsDeDE = {
  notificationSitesLoadFailed: "Die verfügbaren Seiten konnten nicht geladen werden.",
  notificationSettingsLoadFailed: "Die Benachrichtigungseinstellungen konnten nicht geladen werden.",
  notificationSettingsSaveFailed: "Die Benachrichtigungseinstellungen konnten nicht gespeichert werden.",
  notificationSettingsSaved: "Die Benachrichtigungseinstellungen wurden gespeichert.",
  notifications: "Meldungen",
  notificationsIntro: "Wählen Sie aus, welche E-Mail-Benachrichtigungen von der Website verwendet werden.",
  notificationScopeHelp: "Die Benachrichtigungen folgen der Zugriffs- und Arbeitsebene. Der Name der Website wird dem SMTP-Absendernamen hinzugefügt.",
  saveNotificationSettings: "Speichern Sie die Benachrichtigungseinstellungen",
  notifyNewWork: "Neue Arbeit",
  notifyNewWorkHelp: "Benachrichtigen Sie, wenn das Level neue Arbeit erhält.",
  notifyWorkChanges: "Arbeitsveränderungen",
  notifyWorkChangesHelp: "Benachrichtigen Sie das Management, wenn sich die Arbeit auf der Ebene ändert.",
  notifyDecisionRequired: "Erforderliche Maßnahmen",
  notifyDecisionRequiredHelp: "Benachrichtigen Sie den Manager eine Ebene darüber, wenn eine Entscheidung erforderlich ist.",
  notifyChildCompleted: "Kinderarbeit oder Abschlussbericht abgeschlossen",
  notifyChildCompletedHelp: "Benachrichtigen Sie, wenn eine untergeordnete Ebene ihre Arbeit zurückgibt.",
  notifyPlanningCompleted: "Planung abgeschlossen",
  notifyPlanningCompletedHelp: "Benachrichtigen Sie, wenn die Planung zur Genehmigung eingereicht wird.",
  notifyExecutionCompleted: "Ausführung abgeschlossen",
  notifyExecutionCompletedHelp: "Benachrichtigen Sie, wenn die Ausführung zur Überprüfung eingereicht wird.",
} satisfies Partial<Record<MessageKey, string>>;
