import type { MessageKey } from "../../en-US";

export const notificationsRoRO = {
  notificationSitesLoadFailed: "Site-urile disponibile nu au putut fi încărcate.",
  notificationSettingsLoadFailed: "Setările de notificare nu au putut fi încărcate.",
  notificationSettingsSaveFailed: "Setările de notificare nu au putut fi salvate.",
  notificationSettingsSaved: "Configurările de notificare au fost salvate.",
  notifications: "Notificări",
  notificationsIntro: "Alegeţi ce notificări de e-mail sunt folosite de site.",
  notificationScopeHelp: "Notificările urmează nivelul de acces și de lucru. Numele site-ului este adăugat la numele expeditorului SMTP.",
  saveNotificationSettings: "Salvează setările notificării",
  notifyNewWork: "Lucrări noi",
  notifyNewWorkHelp: "Anunță când nivelul primește o nouă lucrare.",
  notifyWorkChanges: "Modificări de muncă",
  notifyWorkChangesHelp: "Anunță managementul atunci când activitatea la nivel se schimbă.",
  notifyDecisionRequired: "Măsuri necesare",
  notifyDecisionRequiredHelp: "Notifică managerul de la nivelul imediat superior atunci când este necesară o decizie.",
  notifyChildCompleted: "Lucrări pentru copii sau raport final finalizat",
  notifyChildCompletedHelp: "Anunta cand un nivel subordonat isi intoarce munca.",
  notifyPlanningCompleted: "Planificarea s-a încheiat",
  notifyPlanningCompletedHelp: "Anunță când se depune o planificare spre aprobare.",
  notifyExecutionCompleted: "Execuția finalizată",
  notifyExecutionCompletedHelp: "Anunță când execuția este supusă spre examinare.",
} satisfies Partial<Record<MessageKey, string>>;
