import type { MessageKey } from "../../en-US";

export const notificationsPtPT = {
  notificationSitesLoadFailed: "Os sites disponíveis não puderam ser carregados.",
  notificationSettingsLoadFailed: "A configuração da notificação não pôde ser carregada.",
  notificationSettingsSaveFailed: "A configuração da notificação não pôde ser guarda.",
  notificationSettingsSaved: "As configurações de notificação foram guardadas.",
  notifications: "Notificações",
  notificationsIntro: "Escolha quais notificações de email são usadas pelo site.",
  notificationScopeHelp: "As notificações seguem o acesso e o nível de trabalho. O nome do site é adicionado ao nome do remetente SMTP.",
  saveNotificationSettings: "Gravar as opções de notificação",
  notifyNewWork: "Novo trabalho",
  notifyNewWorkHelp: "Notifique quando o nível recebe novos trabalhos.",
  notifyWorkChanges: "Alterações no trabalho",
  notifyWorkChangesHelp: "Notificar a gestão quando o trabalho no nível muda.",
  notifyDecisionRequired: "Acção necessária",
  notifyDecisionRequiredHelp: "Notificar o gestor de um nível acima quando uma decisão é necessária.",
  notifyChildCompleted: "Trabalho infantil ou relatório final concluído",
  notifyChildCompletedHelp: "Notificar quando um nível subordinado retorna seu trabalho.",
  notifyPlanningCompleted: "Planeamento concluído",
  notifyPlanningCompletedHelp: "Notificar quando o planeamento for submetido a aprovação.",
  notifyExecutionCompleted: "Execução concluída",
  notifyExecutionCompletedHelp: "Notificar quando a execução é submetida para revisão.",
} satisfies Partial<Record<MessageKey, string>>;
