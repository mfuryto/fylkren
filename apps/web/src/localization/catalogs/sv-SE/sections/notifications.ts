import type { MessageKey } from "../../en-US";

export const notificationsSvSE = {
  notificationSitesLoadFailed: "De tillgängliga platserna kunde inte laddas.",
  notificationSettingsLoadFailed: "Anmälningsinställningarna kunde inte laddas.",
  notificationSettingsSaveFailed: "Anmälningsinställningarna kunde inte sparas.",
  notificationSettingsSaved: "Anmälningsinställningarna sparades.",
  notifications: "Meddelanden",
  notificationsIntro: "Välj vilka e-postmeddelanden som används av webbplatsen.",
  notificationScopeHelp: "Meddelanden följer åtkomst och arbetsnivå. Webbplatsnamnet läggs till i SMTP-sändarenamnet.",
  saveNotificationSettings: "Spara anmälningsinställningar",
  notifyNewWork: "Nytt arbete",
  notifyNewWorkHelp: "Meddela när nivån får nytt arbete.",
  notifyWorkChanges: "Arbetsförändringar",
  notifyWorkChangesHelp: "Meddela hantering när arbetet på nivån förändras.",
  notifyDecisionRequired: "Åtgärd som krävs",
  notifyDecisionRequiredHelp: "Meddela chefen en nivå ovan när ett beslut krävs.",
  notifyChildCompleted: "Barnarbete eller slutrapport slutförd",
  notifyChildCompletedHelp: "Meddela när en underordnad nivå returnerar sitt arbete.",
  notifyPlanningCompleted: "Planering färdigställd",
  notifyPlanningCompletedHelp: "Meddela när planeringen lämnas in för godkännande.",
  notifyExecutionCompleted: "Exekverings färdigställd",
  notifyExecutionCompletedHelp: "Meddela när utförande lämnas in för granskning.",
} satisfies Partial<Record<MessageKey, string>>;
