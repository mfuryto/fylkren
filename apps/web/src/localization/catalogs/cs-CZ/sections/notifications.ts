import type { MessageKey } from "../../en-US";

export const notificationsCsCZ = {
  notificationSitesLoadFailed: "Dostupné stránky nebylo možné načíst.",
  notificationSettingsLoadFailed: "Nastavení oznámení nebylo možné načíst.",
  notificationSettingsSaveFailed: "Nastavení oznámení nebylo možné uložit.",
  notificationSettingsSaved: "Nastavení oznámení bylo uloženo.",
  notifications: "Oznámení",
  notificationsIntro: "Vyberte si, které e-mailové oznámení jsou používány na webu.",
  notificationScopeHelp: "Oznámení respektují přístupová práva a pracovní úroveň. Název Site se přidává ke jménu odesílatele SMTP.",
  saveNotificationSettings: "Uložit nastavení oznámení",
  notifyNewWork: "Nová práce",
  notifyNewWorkHelp: "Upozorněte, kdy úroveň obdrží novou práci.",
  notifyWorkChanges: "Změny v práci",
  notifyWorkChangesHelp: "Upozorňovat na řízení při práci na úrovni změny.",
  notifyDecisionRequired: "Požadovaná akce",
  notifyDecisionRequiredHelp: "Upozorněte vedoucího o jednu úroveň výše, pokud je vyžadováno rozhodnutí.",
  notifyChildCompleted: "Dětská práce nebo závěrečná zpráva dokončená",
  notifyChildCompletedHelp: "Upozornit, když podřízená úroveň vrátí svou práci.",
  notifyPlanningCompleted: "Plánování dokončeno",
  notifyPlanningCompletedHelp: "Upozornit, když je plán předložen ke schválení.",
  notifyExecutionCompleted: "Vykonávání dokončeno",
  notifyExecutionCompletedHelp: "Upozornit, když je realizace předložena ke kontrole.",
} satisfies Partial<Record<MessageKey, string>>;
