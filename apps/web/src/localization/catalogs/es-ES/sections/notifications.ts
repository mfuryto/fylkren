import type { MessageKey } from "../../en-US";

export const notificationsEsES = {
  notificationSitesLoadFailed: "Los sitios disponibles no se pueden cargar.",
  notificationSettingsLoadFailed: "No se pueden cargar los ajustes de notificación.",
  notificationSettingsSaveFailed: "No se pueden guardar los ajustes de notificación.",
  notificationSettingsSaved: "Se guardaron los ajustes de notificación.",
  notifications: "Notificación",
  notificationsIntro: "Elija qué notificaciones de correo electrónico son utilizadas por el sitio.",
  notificationScopeHelp: "Las notificaciones respetan el acceso y el nivel operativo. El nombre del Site se añade al nombre del remitente SMTP.",
  saveNotificationSettings: "Guardar los ajustes de notificación",
  notifyNewWork: "Nuevas tareas",
  notifyNewWorkHelp: "Notificar cuando el nivel reciba una tarea nueva.",
  notifyWorkChanges: "Cambios en las tareas",
  notifyWorkChangesHelp: "Notificar a los responsables cuando cambien las tareas del nivel.",
  notifyDecisionRequired: "Medidas necesarias",
  notifyDecisionRequiredHelp: "Notificar al administrador un nivel superior cuando se requiere una decisión.",
  notifyChildCompleted: "Tarea subordinada o informe final completado",
  notifyChildCompletedHelp: "Notificar cuando un nivel subordinado devuelva una tarea completada.",
  notifyPlanningCompleted: "Planificación terminada",
  notifyPlanningCompletedHelp: "Notificar cuándo se presenta la planificación para su aprobación.",
  notifyExecutionCompleted: "Ejecución terminada",
  notifyExecutionCompletedHelp: "Notificar cuándo se presenta la ejecución para su revisión.",
} satisfies Partial<Record<MessageKey, string>>;
