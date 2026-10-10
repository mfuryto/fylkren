import type { MessageKey } from "../../en-US";

export const notificationsFiFI = {
  notificationSitesLoadFailed: "Käytettävissä olevia Sites ei voitu ladata.",
  notificationSettingsLoadFailed: "Ilmoitusasetuksia ei voitu ladata.",
  notificationSettingsSaveFailed: "Ilmoitusasetuksia ei voitu tallentaa.",
  notificationSettingsSaved: "Ilmoitusasetukset tallennettiin.",
  notifications: "Ilmoitukset",
  notificationsIntro: "Valitse Site-kohteessa käytettävät sähköposti-ilmoitukset.",
  notificationScopeHelp: "Ilmoitukset noudattavat käyttöoikeuksia ja työtasoa. Site-kohteen nimi lisätään SMTP-lähettäjän nimeen.",
  saveNotificationSettings: "Tallenna ilmoitusasetukset",
  notifyNewWork: "Uusi tehtävä",
  notifyNewWorkHelp: "Ilmoita, kun taso saa uuden tehtävän.",
  notifyWorkChanges: "Tehtävän muutokset",
  notifyWorkChangesHelp: "Ilmoita johdolle, kun tehtävän tila muuttuu.",
  notifyDecisionRequired: "Tarvittavat toimet",
  notifyDecisionRequiredHelp: "Ilmoita yhtä tasoa ylemmälle johtajalle, kun päätöstä tarvitaan.",
  notifyChildCompleted: "Alemman tason toimitus tai loppuraportti valmistunut",
  notifyChildCompletedHelp: "Ilmoita, kun alisteinen taso palauttaa työnsä.",
  notifyPlanningCompleted: "Suunnittelu valmis",
  notifyPlanningCompletedHelp: "Ilmoita, kun suunnittelu on toimitettu hyväksyttäväksi.",
  notifyExecutionCompleted: "Toteutus valmis",
  notifyExecutionCompletedHelp: "Ilmoita, kun toteutus lähetetään tarkistettavaksi.",
} satisfies Partial<Record<MessageKey, string>>;
