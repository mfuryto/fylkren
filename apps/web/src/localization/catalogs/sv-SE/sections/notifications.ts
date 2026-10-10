import type { MessageKey } from "../../en-US";

export const notificationsSvSE = {
  notificationSitesLoadFailed: "Tillgängliga Sites kunde inte laddas.",
  notificationSettingsLoadFailed: "Aviseringsinställningarna kunde inte laddas.",
  notificationSettingsSaveFailed: "Aviseringsinställningarna kunde inte sparas.",
  notificationSettingsSaved: "Aviseringsinställningarna sparades.",
  notifications: "Aviseringar",
  notificationsIntro: "Välj vilka e-postaviseringar som ska användas av aktuell Site.",
  notificationScopeHelp: "Aviseringar följer åtkomst och arbetsnivå. Namnet på aktuell Site läggs till i SMTP-avsändarnamnet.",
  saveNotificationSettings: "Spara aviseringsinställningar",
  notifyNewWork: "Nytt uppdrag",
  notifyNewWorkHelp: "Avisera när nivån får ett nytt uppdrag.",
  notifyWorkChanges: "Ändringar i uppdrag",
  notifyWorkChangesHelp: "Avisera ledningen när ett uppdrag på nivån ändras.",
  notifyDecisionRequired: "Åtgärd som krävs",
  notifyDecisionRequiredHelp: "Avisera ansvarig ledare en nivå ovan när ett beslut krävs.",
  notifyChildCompleted: "Underordnat uppdrag eller slutrapport slutförd",
  notifyChildCompletedHelp: "Avisera när en underordnad nivå återrapporterar sitt uppdrag.",
  notifyPlanningCompleted: "Planering slutförd",
  notifyPlanningCompletedHelp: "Avisera när planeringen lämnas in för godkännande.",
  notifyExecutionCompleted: "Genomförande slutfört",
  notifyExecutionCompletedHelp: "Avisera när genomförandet lämnas in för granskning.",
} satisfies Partial<Record<MessageKey, string>>;
