import type { MessageKey } from "../../en-US";

export const notificationsLtLT = {
  notificationSitesLoadFailed: "Turimų svetainių nebuvo galima įkelti.",
  notificationSettingsLoadFailed: "Nepavyko įkelti pranešimo nustatymų.",
  notificationSettingsSaveFailed: "Nepavyko išsaugoti pranešimų nustatymų.",
  notificationSettingsSaved: "Pranešimų nustatymai išsaugoti.",
  notifications: "Pranešimai",
  notificationsIntro: "Pasirinkite, kurie e. pašto pranešimai yra naudojami svetainėje.",
  notificationScopeHelp: "Pranešimai priklauso nuo prieigos teisių ir darbo lygio. Site pavadinimas pridedamas prie SMTP siuntėjo vardo.",
  saveNotificationSettings: "Įrašyti pranešimo nustatymus",
  notifyNewWork: "Naujas darbas",
  notifyNewWorkHelp: "Pasakykite, kai lygis gauna naują darbą.",
  notifyWorkChanges: "Darbo pokyčiai",
  notifyWorkChangesHelp: "Praneškite valdymui, kai darbas lygio pokyčių.",
  notifyDecisionRequired: "Reikiami veiksmai",
  notifyDecisionRequiredHelp: "Pranešti vienu lygiu aukštesniam vadovui, kai reikia sprendimo.",
  notifyChildCompleted: "Vaikų darbas arba galutinė ataskaita baigta",
  notifyChildCompletedHelp: "Pasakykite, kai pavaldus lygis grąžina savo darbą.",
  notifyPlanningCompleted: "Planavimas baigtas",
  notifyPlanningCompletedHelp: "pranešti, kai planas pateikiamas patvirtinti.",
  notifyExecutionCompleted: "Baigtas vykdymas",
  notifyExecutionCompletedHelp: "Pranešti, kai atliktas darbas pateikiamas patikrinti.",
} satisfies Partial<Record<MessageKey, string>>;
