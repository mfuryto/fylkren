export const lifecycleUiEn = {
  "lifecycleStateActive": "Active",
  "lifecycleStateClosed": "Locked",
  "lifecycleStateArchived": "Archived",
  "lifecycleLockedError": "The content is locked or archived. Reopen it through Lock/Archive before editing. Archived content must first be restored to locked.",
  "lifecycleUnfinishedError": "Finish related work and pending delivery before locking or archiving.",
  "lifecycleVersionError": "The information state changed. Reload the task before trying again.",
  "lifecycleTransitionError": "This action is unavailable in the current information state."
} as const;

export const lifecycleUiTranslations: Record<string, Record<keyof typeof lifecycleUiEn, string>> = {
  "en-US": {
    "lifecycleStateActive": "Active",
    "lifecycleStateClosed": "Locked",
    "lifecycleStateArchived": "Archived",
    "lifecycleLockedError": "The content is locked or archived. Reopen it through Lock/Archive before editing. Archived content must first be restored to locked.",
    "lifecycleUnfinishedError": "Finish related work and pending delivery before locking or archiving.",
    "lifecycleVersionError": "The information state changed. Reload the task before trying again.",
    "lifecycleTransitionError": "This action is unavailable in the current information state."
  },
  "nb-NO": {
    "lifecycleStateActive": "Aktiv",
    "lifecycleStateClosed": "Låst",
    "lifecycleStateArchived": "Arkivert",
    "lifecycleLockedError": "Innholdet er låst eller arkivert. Gjenåpne det via Lås/Arkiver før du gjør endringer. Arkivert innhold må først gjenopprettes som låst.",
    "lifecycleUnfinishedError": "Fullfør tilknyttet arbeid og ventende levering før du låser eller arkiverer.",
    "lifecycleVersionError": "Tilstanden er endret. Last oppdraget på nytt før du prøver igjen.",
    "lifecycleTransitionError": "Handlingen er ikke tilgjengelig i denne tilstanden."
  },
  "sv-SE": {
    "lifecycleStateActive": "Aktiv",
    "lifecycleStateClosed": "Låst",
    "lifecycleStateArchived": "Arkiverad",
    "lifecycleLockedError": "Innehållet är låst eller arkiverat. Öppna det igen innan du ändrar det. Arkiverat innehåll måste först återställas till låst.",
    "lifecycleUnfinishedError": "Slutför relaterat arbete och väntande leverans innan du låser eller arkiverar.",
    "lifecycleVersionError": "Tillståndet har ändrats. Ladda om uppdraget och försök igen.",
    "lifecycleTransitionError": "Åtgärden är inte tillgänglig i detta tillstånd."
  },
  "da-DK": {
    "lifecycleStateActive": "Aktiv",
    "lifecycleStateClosed": "Låst",
    "lifecycleStateArchived": "Arkiveret",
    "lifecycleLockedError": "Indholdet er låst eller arkiveret. Genåbn det via Lås/arkivér før redigering. Arkiveret indhold skal først gendannes som låst.",
    "lifecycleUnfinishedError": "Afslut relateret arbejde og ventende levering før låsning eller arkivering.",
    "lifecycleVersionError": "Tilstanden er ændret. Genindlæs opgaven og prøv igen.",
    "lifecycleTransitionError": "Handlingen er ikke tilgængelig i denne tilstand."
  },
  "fi-FI": {
    "lifecycleStateActive": "Aktiivinen",
    "lifecycleStateClosed": "Lukittu",
    "lifecycleStateArchived": "Arkistoitu",
    "lifecycleLockedError": "Sisältö on lukittu tai arkistoitu. Avaa se uudelleen ennen muokkaamista. Arkistoitu sisältö on ensin palautettava lukituksi.",
    "lifecycleUnfinishedError": "Viimeistele liittyvä työ ja odottava toimitus ennen lukitsemista tai arkistointia.",
    "lifecycleVersionError": "Tila on muuttunut. Lataa tehtävä uudelleen ja yritä uudestaan.",
    "lifecycleTransitionError": "Toiminto ei ole käytettävissä tässä tilassa."
  },
  "de-DE": {
    "lifecycleStateActive": "Aktiv",
    "lifecycleStateClosed": "Gesperrt",
    "lifecycleStateArchived": "Archiviert",
    "lifecycleLockedError": "Der Inhalt ist gesperrt oder archiviert. Öffnen Sie ihn vor der Bearbeitung erneut. Archivierter Inhalt muss zuerst als gesperrt wiederhergestellt werden.",
    "lifecycleUnfinishedError": "Schließen Sie zugehörige Arbeit und ausstehende Zustellung vor dem Sperren oder Archivieren ab.",
    "lifecycleVersionError": "Der Zustand hat sich geändert. Laden Sie den Auftrag neu und versuchen Sie es erneut.",
    "lifecycleTransitionError": "Diese Aktion ist im aktuellen Zustand nicht verfügbar."
  },
  "fr-FR": {
    "lifecycleStateActive": "Actif",
    "lifecycleStateClosed": "Verrouillé",
    "lifecycleStateArchived": "Archivé",
    "lifecycleLockedError": "Le contenu est verrouillé ou archivé. Rouvrez-le avant de le modifier. Le contenu archivé doit d’abord être restauré à l’état verrouillé.",
    "lifecycleUnfinishedError": "Terminez le travail associé et les livraisons en attente avant de verrouiller ou d’archiver.",
    "lifecycleVersionError": "L’état a changé. Rechargez la tâche et réessayez.",
    "lifecycleTransitionError": "Cette action n’est pas disponible dans l’état actuel."
  },
  "pl-PL": {
    "lifecycleStateActive": "Aktywne",
    "lifecycleStateClosed": "Zablokowane",
    "lifecycleStateArchived": "Zarchiwizowane",
    "lifecycleLockedError": "Treść jest zablokowana lub zarchiwizowana. Otwórz ją ponownie przed edycją. Zarchiwizowaną treść trzeba najpierw przywrócić do stanu zablokowanego.",
    "lifecycleUnfinishedError": "Zakończ powiązane prace i oczekujące dostarczenie przed blokowaniem lub archiwizacją.",
    "lifecycleVersionError": "Stan się zmienił. Wczytaj zadanie ponownie i spróbuj jeszcze raz.",
    "lifecycleTransitionError": "Ta czynność nie jest dostępna w bieżącym stanie."
  },
  "es-ES": {
    "lifecycleStateActive": "Activo",
    "lifecycleStateClosed": "Bloqueado",
    "lifecycleStateArchived": "Archivado",
    "lifecycleLockedError": "El contenido está bloqueado o archivado. Reábralo antes de editarlo. El contenido archivado debe restaurarse primero al estado bloqueado.",
    "lifecycleUnfinishedError": "Complete el trabajo relacionado y las entregas pendientes antes de bloquear o archivar.",
    "lifecycleVersionError": "El estado ha cambiado. Recargue la tarea e inténtelo de nuevo.",
    "lifecycleTransitionError": "Esta acción no está disponible en el estado actual."
  },
  "it-IT": {
    "lifecycleStateActive": "Attivo",
    "lifecycleStateClosed": "Bloccato",
    "lifecycleStateArchived": "Archiviato",
    "lifecycleLockedError": "Il contenuto è bloccato o archiviato. Riaprilo prima di modificarlo. Il contenuto archiviato deve prima essere ripristinato allo stato bloccato.",
    "lifecycleUnfinishedError": "Completa il lavoro correlato e le consegne in attesa prima di bloccare o archiviare.",
    "lifecycleVersionError": "Lo stato è cambiato. Ricarica l’attività e riprova.",
    "lifecycleTransitionError": "Questa azione non è disponibile nello stato attuale."
  },
  "uk-UA": {
    "lifecycleStateActive": "Активний",
    "lifecycleStateClosed": "Заблокований",
    "lifecycleStateArchived": "Архівований",
    "lifecycleLockedError": "Вміст заблоковано або архівовано. Відкрийте його повторно перед редагуванням. Архівований вміст спочатку потрібно відновити до заблокованого стану.",
    "lifecycleUnfinishedError": "Завершіть пов’язану роботу та очікувану доставку перед блокуванням або архівуванням.",
    "lifecycleVersionError": "Стан змінився. Перезавантажте завдання та спробуйте знову.",
    "lifecycleTransitionError": "Ця дія недоступна в поточному стані."
  },
  "nl-NL": {
    "lifecycleStateActive": "Actief",
    "lifecycleStateClosed": "Vergrendeld",
    "lifecycleStateArchived": "Gearchiveerd",
    "lifecycleLockedError": "De inhoud is vergrendeld of gearchiveerd. Heropen deze vóór bewerking. Gearchiveerde inhoud moet eerst naar vergrendeld worden hersteld.",
    "lifecycleUnfinishedError": "Rond gerelateerd werk en openstaande levering af voordat u vergrendelt of archiveert.",
    "lifecycleVersionError": "De toestand is gewijzigd. Laad de taak opnieuw en probeer het nogmaals.",
    "lifecycleTransitionError": "Deze actie is niet beschikbaar in de huidige toestand."
  },
  "pt-PT": {
    "lifecycleStateActive": "Ativo",
    "lifecycleStateClosed": "Bloqueado",
    "lifecycleStateArchived": "Arquivado",
    "lifecycleLockedError": "O conteúdo está bloqueado ou arquivado. Reabra-o antes de editar. O conteúdo arquivado deve primeiro ser restaurado para bloqueado.",
    "lifecycleUnfinishedError": "Conclua o trabalho relacionado e as entregas pendentes antes de bloquear ou arquivar.",
    "lifecycleVersionError": "O estado mudou. Recarregue a tarefa e tente novamente.",
    "lifecycleTransitionError": "Esta ação não está disponível no estado atual."
  },
  "cs-CZ": {
    "lifecycleStateActive": "Aktivní",
    "lifecycleStateClosed": "Uzamčeno",
    "lifecycleStateArchived": "Archivováno",
    "lifecycleLockedError": "Obsah je uzamčený nebo archivovaný. Před úpravou jej znovu otevřete. Archivovaný obsah je nejprve nutné obnovit do uzamčeného stavu.",
    "lifecycleUnfinishedError": "Před uzamčením nebo archivací dokončete související práci a čekající doručení.",
    "lifecycleVersionError": "Stav se změnil. Načtěte úkol znovu a opakujte akci.",
    "lifecycleTransitionError": "Tato akce není v aktuálním stavu dostupná."
  },
  "ro-RO": {
    "lifecycleStateActive": "Activ",
    "lifecycleStateClosed": "Blocat",
    "lifecycleStateArchived": "Arhivat",
    "lifecycleLockedError": "Conținutul este blocat sau arhivat. Redeschideți-l înainte de editare. Conținutul arhivat trebuie mai întâi restaurat în starea blocată.",
    "lifecycleUnfinishedError": "Finalizați lucrările asociate și livrările în așteptare înainte de blocare sau arhivare.",
    "lifecycleVersionError": "Starea s-a schimbat. Reîncărcați sarcina și încercați din nou.",
    "lifecycleTransitionError": "Această acțiune nu este disponibilă în starea actuală."
  },
  "et-EE": {
    "lifecycleStateActive": "Aktiivne",
    "lifecycleStateClosed": "Lukustatud",
    "lifecycleStateArchived": "Arhiveeritud",
    "lifecycleLockedError": "Sisu on lukustatud või arhiveeritud. Enne muutmist avage see uuesti. Arhiveeritud sisu tuleb esmalt taastada lukustatud olekusse.",
    "lifecycleUnfinishedError": "Enne lukustamist või arhiveerimist lõpetage seotud töö ja ootel edastamine.",
    "lifecycleVersionError": "Olek on muutunud. Laadige ülesanne uuesti ja proovige veel kord.",
    "lifecycleTransitionError": "See toiming pole praeguses olekus saadaval."
  },
  "lv-LV": {
    "lifecycleStateActive": "Aktīvs",
    "lifecycleStateClosed": "Bloķēts",
    "lifecycleStateArchived": "Arhivēts",
    "lifecycleLockedError": "Saturs ir bloķēts vai arhivēts. Pirms rediģēšanas atveriet to atkārtoti. Arhivēts saturs vispirms jāatjauno bloķētā stāvoklī.",
    "lifecycleUnfinishedError": "Pirms bloķēšanas vai arhivēšanas pabeidziet saistīto darbu un gaidošo piegādi.",
    "lifecycleVersionError": "Stāvoklis ir mainījies. Ielādējiet uzdevumu atkārtoti un mēģiniet vēlreiz.",
    "lifecycleTransitionError": "Šī darbība nav pieejama pašreizējā stāvoklī."
  },
  "lt-LT": {
    "lifecycleStateActive": "Aktyvus",
    "lifecycleStateClosed": "Užrakintas",
    "lifecycleStateArchived": "Archyvuotas",
    "lifecycleLockedError": "Turinys užrakintas arba archyvuotas. Prieš redaguodami atverkite jį iš naujo. Archyvuotą turinį pirmiausia reikia atkurti į užrakintą būseną.",
    "lifecycleUnfinishedError": "Prieš užrakindami ar archyvuodami užbaikite susijusį darbą ir laukiamą pristatymą.",
    "lifecycleVersionError": "Būsena pasikeitė. Iš naujo įkelkite užduotį ir bandykite dar kartą.",
    "lifecycleTransitionError": "Šis veiksmas negalimas dabartinėje būsenoje."
  },
  "en-GB": {
    "lifecycleStateActive": "Active",
    "lifecycleStateClosed": "Locked",
    "lifecycleStateArchived": "Archived",
    "lifecycleLockedError": "The content is locked or archived. Reopen it through Lock/Archive before editing. Archived content must first be restored to locked.",
    "lifecycleUnfinishedError": "Finish related work and pending delivery before locking or archiving.",
    "lifecycleVersionError": "The information state changed. Reload the task before trying again.",
    "lifecycleTransitionError": "This action is unavailable in the current information state."
  }
};
