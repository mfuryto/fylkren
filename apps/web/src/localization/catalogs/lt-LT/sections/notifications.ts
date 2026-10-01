import type { MessageKey } from "../../en-US";

export const notificationsLtLT = {
  notificationSitesLoadFailed: "Turimų svetainių nebuvo galima įkelti.",
  notificationSettingsLoadFailed: "Nepavyko įkelti pranešimo nustatymų.",
  notificationSettingsSaveFailed: "@ info: whatsthis",
  notificationSettingsSaved: "@ info: whatsthis",
  notifications: "Pranešimai",
  notificationsIntro: "Pasirinkite, kurie e. pašto pranešimai yra naudojami svetainėje.",
  notificationScopeHelp: "Pranešimai sekti prieigos ir darbo lygį. Svetainės pavadinimas pridedamas prie SMTP siuntėjo pavadinimą.",
  saveNotificationSettings: "Įrašyti pranešimo nustatymus",
  notifyNewWork: "Naujas darbas",
  notifyNewWorkHelp: "Pasakykite, kai lygis gauna naują darbą.",
  notifyWorkChanges: "Darbo pokyčiai",
  notifyWorkChangesHelp: "Praneškite valdymui, kai darbas lygio pokyčių.",
  notifyDecisionRequired: "Reikiami veiksmai",
  notifyDecisionRequiredHelp: "Pasakykite valdytojui, kad kai reikia priimti sprendimą, vienas lygis yra aukščiau.",
  notifyChildCompleted: "Vaikų darbas arba galutinė ataskaita baigta",
  notifyChildCompletedHelp: "Pasakykite, kai pavaldus lygis grąžina savo darbą.",
  notifyPlanningCompleted: "Planavimas baigtas",
  notifyPlanningCompletedHelp: "pranešti, kai planas pateikiamas patvirtinti.",
  notifyExecutionCompleted: "Baigtas vykdymas",
  notifyExecutionCompletedHelp: "Pasakykite, kai pateikiamas prašymas peržiūrėti vykdymą.",
} satisfies Partial<Record<MessageKey, string>>;
