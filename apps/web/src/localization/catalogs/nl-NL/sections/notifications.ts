import type { MessageKey } from "../../en-US";

export const notificationsNlNL = {
  notificationSitesLoadFailed: "De beschikbare sites konden niet geladen worden.",
  notificationSettingsLoadFailed: "De notificatie-instellingen konden niet geladen worden.",
  notificationSettingsSaveFailed: "De notificatie-instellingen konden niet worden opgeslagen.",
  notificationSettingsSaved: "De notificatie-instellingen zijn opgeslagen.",
  notifications: "Kennisgevingen",
  notificationsIntro: "Kies welke e-mailmeldingen door de site worden gebruikt.",
  notificationScopeHelp: "Meldingen volgen toegang en werkniveau. De naam van de site wordt toegevoegd aan de SMTP afzender naam.",
  saveNotificationSettings: "Notificatieinstellingen opslaan",
  notifyNewWork: "Nieuwe werkzaamheden",
  notifyNewWorkHelp: "Waarschuwen wanneer het niveau nieuwe werk ontvangt.",
  notifyWorkChanges: "Wijzigingen in het werk",
  notifyWorkChangesHelp: "Het management informeren wanneer het werk op het niveau verandert.",
  notifyDecisionRequired: "Vereiste actie",
  notifyDecisionRequiredHelp: "Licht de beheerder één niveau boven in wanneer een beslissing vereist is.",
  notifyChildCompleted: "Kinderwerk of eindverslag voltooid",
  notifyChildCompletedHelp: "Waarschuwen wanneer een ondergeschikte niveau zijn werk teruggeeft.",
  notifyPlanningCompleted: "Planning voltooid",
  notifyPlanningCompletedHelp: "Waarschuwen wanneer de planning ter goedkeuring wordt voorgelegd.",
  notifyExecutionCompleted: "Uitvoering voltooid",
  notifyExecutionCompletedHelp: "Waarschuwen wanneer de uitvoering ter beoordeling wordt voorgelegd.",
} satisfies Partial<Record<MessageKey, string>>;
