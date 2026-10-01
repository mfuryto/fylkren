import type { MessageKey } from "../../en-US";

export const notificationsEsES = {
  notificationSitesLoadFailed: "Los sitios disponibles no se pueden cargar.",
  notificationSettingsLoadFailed: "No se pueden cargar los ajustes de notificación.",
  notificationSettingsSaveFailed: "No se pueden guardar los ajustes de notificación.",
  notificationSettingsSaved: "Se guardaron los ajustes de notificación.",
  notifications: "Notificación",
  notificationsIntro: "Elija qué notificaciones de correo electrónico son utilizadas por el sitio.",
  notificationScopeHelp: "Las notificaciones siguen el acceso y el nivel de trabajo. El nombre del sitio se añade al nombre del remitente SMTP.",
  saveNotificationSettings: "Guardar los ajustes de notificación",
  notifyNewWork: "Nuevo trabajo",
  notifyNewWorkHelp: "Notificar cuando el nivel recibe nuevo trabajo.",
  notifyWorkChanges: "Cambios de trabajo",
  notifyWorkChangesHelp: "Notificar a la administración cuando el trabajo cambia de nivel.",
  notifyDecisionRequired: "Medidas necesarias",
  notifyDecisionRequiredHelp: "Notificar al administrador un nivel superior cuando se requiere una decisión.",
  notifyChildCompleted: "Trabajo infantil o informe final completado",
  notifyChildCompletedHelp: "Notificar cuando un nivel subordinado devuelve su trabajo.",
  notifyPlanningCompleted: "Planificación terminada",
  notifyPlanningCompletedHelp: "Notificar cuándo se presenta la planificación para su aprobación.",
  notifyExecutionCompleted: "Ejecución terminada",
  notifyExecutionCompletedHelp: "Notificar cuándo se presenta la ejecución para su revisión.",
} satisfies Partial<Record<MessageKey, string>>;
