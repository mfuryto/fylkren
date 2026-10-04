export const lifecycleAutomationEn = {
  "lifecycleFinishEditing": "Finish editing",
  "lifecycleAutomaticHelp": "Locks automatically after final completion, rejection or cancellation. Archives when follow-up and required deliveries are resolved. Find archived tasks under Tasks → Show → Archived. Learning continues independently.",
  "lifecycleAutomaticEditing": "Reopened for editing. Automatic locking and archiving are paused until editing is finished or a new final task decision is made.",
  "lifecyclePendingLock": "Automatic locking is waiting for",
  "lifecyclePendingArchive": "Automatic archiving is waiting for",
  "lifecycleArchivedTasks": "Archived"
} as const;

export const lifecycleAutomationTranslations: Record<string, Record<keyof typeof lifecycleAutomationEn, string>> = {
  "en-US": {
    "lifecycleFinishEditing": "Finish editing",
    "lifecycleAutomaticHelp": "Locks automatically after final completion, rejection or cancellation. Archives when follow-up and required deliveries are resolved. Find archived tasks under Tasks → Show → Archived. Learning continues independently.",
    "lifecycleAutomaticEditing": "Reopened for editing. Automatic locking and archiving are paused until editing is finished or a new final task decision is made.",
    "lifecyclePendingLock": "Automatic locking is waiting for",
    "lifecyclePendingArchive": "Automatic archiving is waiting for",
    "lifecycleArchivedTasks": "Archived"
  },
  "nb-NO": {
    "lifecycleFinishEditing": "Avslutt redigering",
    "lifecycleAutomaticHelp": "Låses automatisk når oppgaven fullføres med godkjent sluttrapport, eller avvises eller kanselleres endelig. Arkiveres når oppfølging og nødvendige leveranser er avklart. Finn arkiverte oppgaver under Oppgaver → Vis → Arkiverte. Læring fortsetter uavhengig.",
    "lifecycleAutomaticEditing": "Gjenåpnet for redigering. Automatisk låsing og arkivering er satt på pause til redigeringen avsluttes eller oppgaven får en ny endelig avgjørelse.",
    "lifecyclePendingLock": "Automatisk låsing venter på",
    "lifecyclePendingArchive": "Automatisk arkivering venter på",
    "lifecycleArchivedTasks": "Arkiverte"
  },
  "sv-SE": {
    "lifecycleFinishEditing": "Avsluta redigering",
    "lifecycleAutomaticHelp": "Låses automatiskt efter slutligt slutförande, avslag eller avbokning. Arkiveras när uppföljning och nödvändiga leveranser är klara. Arkiverade uppgifter finns under Uppgifter → Visa → Arkiverade. Lärande fortsätter separat.",
    "lifecycleAutomaticEditing": "Öppnad för redigering. Automatisk låsning och arkivering pausas tills redigeringen avslutas eller uppgiften får ett nytt slutligt beslut.",
    "lifecyclePendingLock": "Automatisk låsning väntar på",
    "lifecyclePendingArchive": "Automatisk arkivering väntar på",
    "lifecycleArchivedTasks": "Arkiverade"
  },
  "da-DK": {
    "lifecycleFinishEditing": "Afslut redigering",
    "lifecycleAutomaticHelp": "Låses automatisk efter endelig afslutning, afvisning eller annullering. Arkiveres når opfølgning og nødvendige leverancer er afklaret. Find arkiverede opgaver under Opgaver → Vis → Arkiverede. Læring fortsætter særskilt.",
    "lifecycleAutomaticEditing": "Genåbnet til redigering. Automatisk låsning og arkivering er sat på pause, indtil redigeringen afsluttes eller opgaven får en ny endelig afgørelse.",
    "lifecyclePendingLock": "Automatisk låsning afventer",
    "lifecyclePendingArchive": "Automatisk arkivering afventer",
    "lifecycleArchivedTasks": "Arkiverede"
  },
  "fi-FI": {
    "lifecycleFinishEditing": "Lopeta muokkaus",
    "lifecycleAutomaticHelp": "Lukittuu automaattisesti lopullisen valmistumisen, hylkäämisen tai perumisen jälkeen. Arkistoidaan, kun seuranta ja tarvittavat toimitukset ovat valmiit. Arkistoidut tehtävät löytyvät kohdasta Tehtävät → Näytä → Arkistoidut. Oppiminen jatkuu erikseen.",
    "lifecycleAutomaticEditing": "Avattu muokattavaksi. Automaattinen lukitus ja arkistointi on keskeytetty, kunnes muokkaus päättyy tai tehtävä saa uuden lopullisen päätöksen.",
    "lifecyclePendingLock": "Automaattinen lukitus odottaa",
    "lifecyclePendingArchive": "Automaattinen arkistointi odottaa",
    "lifecycleArchivedTasks": "Arkistoidut"
  },
  "de-DE": {
    "lifecycleFinishEditing": "Bearbeitung abschließen",
    "lifecycleAutomaticHelp": "Wird nach endgültigem Abschluss, Ablehnung oder Abbruch automatisch gesperrt. Archivierung folgt nach geklärter Nachverfolgung und erforderlichen Zustellungen. Archivierte Aufgaben: Aufgaben → Anzeigen → Archiviert. Lernen läuft unabhängig weiter.",
    "lifecycleAutomaticEditing": "Zur Bearbeitung wieder geöffnet. Automatische Sperrung und Archivierung pausieren bis zum Ende der Bearbeitung oder einer neuen endgültigen Aufgabenentscheidung.",
    "lifecyclePendingLock": "Automatische Sperrung wartet auf",
    "lifecyclePendingArchive": "Automatische Archivierung wartet auf",
    "lifecycleArchivedTasks": "Archiviert"
  },
  "fr-FR": {
    "lifecycleFinishEditing": "Terminer la modification",
    "lifecycleAutomaticHelp": "Verrouillage automatique après achèvement définitif, refus ou annulation. Archivage après résolution du suivi et des livraisons requises. Tâches archivées : Tâches → Afficher → Archivées. Les apprentissages se poursuivent séparément.",
    "lifecycleAutomaticEditing": "Rouvert pour modification. Le verrouillage et l’archivage automatiques sont suspendus jusqu’à la fin des modifications ou une nouvelle décision finale.",
    "lifecyclePendingLock": "Le verrouillage automatique attend",
    "lifecyclePendingArchive": "L’archivage automatique attend",
    "lifecycleArchivedTasks": "Archivées"
  },
  "pl-PL": {
    "lifecycleFinishEditing": "Zakończ edycję",
    "lifecycleAutomaticHelp": "Automatyczna blokada po ostatecznym zakończeniu, odrzuceniu lub anulowaniu. Archiwizacja po zakończeniu dalszych działań i wymaganych dostarczeń. Zadania archiwalne: Zadania → Pokaż → Zarchiwizowane. Wnioski są przetwarzane niezależnie.",
    "lifecycleAutomaticEditing": "Ponownie otwarte do edycji. Automatyczna blokada i archiwizacja są wstrzymane do zakończenia edycji lub nowej ostatecznej decyzji.",
    "lifecyclePendingLock": "Automatyczna blokada oczekuje na",
    "lifecyclePendingArchive": "Automatyczna archiwizacja oczekuje na",
    "lifecycleArchivedTasks": "Zarchiwizowane"
  },
  "es-ES": {
    "lifecycleFinishEditing": "Finalizar edición",
    "lifecycleAutomaticHelp": "Se bloquea automáticamente tras la finalización definitiva, el rechazo o la cancelación. Se archiva cuando se resuelven el seguimiento y las entregas necesarias. Tareas archivadas: Tareas → Mostrar → Archivadas. El aprendizaje continúa por separado.",
    "lifecycleAutomaticEditing": "Reabierto para editar. El bloqueo y el archivado automáticos se pausan hasta finalizar la edición o tomar una nueva decisión final.",
    "lifecyclePendingLock": "El bloqueo automático espera",
    "lifecyclePendingArchive": "El archivado automático espera",
    "lifecycleArchivedTasks": "Archivadas"
  },
  "it-IT": {
    "lifecycleFinishEditing": "Termina modifica",
    "lifecycleAutomaticHelp": "Blocco automatico dopo completamento definitivo, rifiuto o annullamento. Archiviazione dopo la risoluzione del seguito e delle consegne richieste. Attività archiviate: Attività → Mostra → Archiviate. L’apprendimento continua separatamente.",
    "lifecycleAutomaticEditing": "Riaperto per modifiche. Blocco e archiviazione automatici sospesi fino alla fine delle modifiche o a una nuova decisione definitiva.",
    "lifecyclePendingLock": "Il blocco automatico attende",
    "lifecyclePendingArchive": "L’archiviazione automatica attende",
    "lifecycleArchivedTasks": "Archiviate"
  },
  "uk-UA": {
    "lifecycleFinishEditing": "Завершити редагування",
    "lifecycleAutomaticHelp": "Автоматичне блокування після остаточного завершення, відхилення або скасування. Архівування після врегулювання подальших дій і необхідних доставок. Архівні завдання: Завдання → Показати → Архівні. Опрацювання досвіду триває окремо.",
    "lifecycleAutomaticEditing": "Відкрито для редагування. Автоматичне блокування й архівування призупинено до завершення редагування або нового остаточного рішення.",
    "lifecyclePendingLock": "Автоматичне блокування очікує на",
    "lifecyclePendingArchive": "Автоматичне архівування очікує на",
    "lifecycleArchivedTasks": "Архівні"
  },
  "nl-NL": {
    "lifecycleFinishEditing": "Bewerken afronden",
    "lifecycleAutomaticHelp": "Automatische vergrendeling na definitieve voltooiing, afwijzing of annulering. Archivering zodra opvolging en vereiste leveringen zijn afgerond. Archief: Taken → Tonen → Gearchiveerd. Leren gaat afzonderlijk verder.",
    "lifecycleAutomaticEditing": "Heropend voor bewerking. Automatische vergrendeling en archivering zijn gepauzeerd tot bewerking is afgerond of een nieuw definitief besluit is genomen.",
    "lifecyclePendingLock": "Automatische vergrendeling wacht op",
    "lifecyclePendingArchive": "Automatische archivering wacht op",
    "lifecycleArchivedTasks": "Gearchiveerd"
  },
  "pt-PT": {
    "lifecycleFinishEditing": "Concluir edição",
    "lifecycleAutomaticHelp": "Bloqueio automático após conclusão definitiva, rejeição ou cancelamento. Arquivamento quando o acompanhamento e as entregas necessárias estiverem resolvidos. Tarefas arquivadas: Tarefas → Mostrar → Arquivadas. A aprendizagem continua separadamente.",
    "lifecycleAutomaticEditing": "Reaberto para edição. O bloqueio e o arquivamento automáticos ficam suspensos até concluir a edição ou tomar uma nova decisão final.",
    "lifecyclePendingLock": "O bloqueio automático aguarda",
    "lifecyclePendingArchive": "O arquivamento automático aguarda",
    "lifecycleArchivedTasks": "Arquivadas"
  },
  "cs-CZ": {
    "lifecycleFinishEditing": "Dokončit úpravy",
    "lifecycleAutomaticHelp": "Automatické uzamčení po konečném dokončení, zamítnutí nebo zrušení. Archivace po vyřešení následných kroků a potřebných doručení. Archivované úkoly: Úkoly → Zobrazit → Archivované. Učení pokračuje samostatně.",
    "lifecycleAutomaticEditing": "Znovu otevřeno k úpravám. Automatické uzamčení a archivace jsou pozastaveny do dokončení úprav nebo nového konečného rozhodnutí.",
    "lifecyclePendingLock": "Automatické uzamčení čeká na",
    "lifecyclePendingArchive": "Automatická archivace čeká na",
    "lifecycleArchivedTasks": "Archivované"
  },
  "ro-RO": {
    "lifecycleFinishEditing": "Încheie editarea",
    "lifecycleAutomaticHelp": "Blocare automată după finalizare definitivă, respingere sau anulare. Arhivare după rezolvarea urmăririi și livrărilor necesare. Sarcini arhivate: Sarcini → Afișare → Arhivate. Învățarea continuă separat.",
    "lifecycleAutomaticEditing": "Redeschis pentru editare. Blocarea și arhivarea automate sunt suspendate până la încheierea editării sau o nouă decizie finală.",
    "lifecyclePendingLock": "Blocarea automată așteaptă",
    "lifecyclePendingArchive": "Arhivarea automată așteaptă",
    "lifecycleArchivedTasks": "Arhivate"
  },
  "et-EE": {
    "lifecycleFinishEditing": "Lõpeta muutmine",
    "lifecycleAutomaticHelp": "Lukustub automaatselt pärast lõplikku lõpetamist, tagasilükkamist või tühistamist. Arhiveeritakse, kui järeltegevused ja vajalikud edastused on lahendatud. Arhiveeritud ülesanded: Ülesanded → Näita → Arhiveeritud. Õppimine jätkub eraldi.",
    "lifecycleAutomaticEditing": "Muudatusteks taasavatud. Automaatne lukustamine ja arhiveerimine on peatatud kuni muutmise lõpetamiseni või uue lõpliku otsuseni.",
    "lifecyclePendingLock": "Automaatne lukustamine ootab",
    "lifecyclePendingArchive": "Automaatne arhiveerimine ootab",
    "lifecycleArchivedTasks": "Arhiveeritud"
  },
  "lv-LV": {
    "lifecycleFinishEditing": "Pabeigt rediģēšanu",
    "lifecycleAutomaticHelp": "Automātiski bloķē pēc galīgas pabeigšanas, noraidīšanas vai atcelšanas. Arhivē pēc turpmāko darbību un nepieciešamo piegāžu atrisināšanas. Arhivēti uzdevumi: Uzdevumi → Rādīt → Arhivēti. Mācīšanās turpinās atsevišķi.",
    "lifecycleAutomaticEditing": "Atvērts rediģēšanai. Automātiskā bloķēšana un arhivēšana ir apturēta līdz rediģēšanas pabeigšanai vai jaunam galīgam lēmumam.",
    "lifecyclePendingLock": "Automātiskā bloķēšana gaida",
    "lifecyclePendingArchive": "Automātiskā arhivēšana gaida",
    "lifecycleArchivedTasks": "Arhivēti"
  },
  "lt-LT": {
    "lifecycleFinishEditing": "Baigti redagavimą",
    "lifecycleAutomaticHelp": "Automatiškai užrakinama po galutinio užbaigimo, atmetimo ar atšaukimo. Archyvuojama išsprendus tolesnius veiksmus ir būtinus pristatymus. Archyvuotos užduotys: Užduotys → Rodyti → Archyvuotos. Mokymasis tęsiamas atskirai.",
    "lifecycleAutomaticEditing": "Vėl atidaryta redaguoti. Automatinis užrakinimas ir archyvavimas sustabdyti iki redagavimo pabaigos arba naujo galutinio sprendimo.",
    "lifecyclePendingLock": "Automatinis užrakinimas laukia",
    "lifecyclePendingArchive": "Automatinis archyvavimas laukia",
    "lifecycleArchivedTasks": "Archyvuotos"
  },
  "en-GB": {
    "lifecycleFinishEditing": "Finish editing",
    "lifecycleAutomaticHelp": "Locks automatically after final completion, rejection or cancellation. Archives when follow-up and required deliveries are resolved. Find archived tasks under Tasks → Show → Archived. Learning continues independently.",
    "lifecycleAutomaticEditing": "Reopened for editing. Automatic locking and archiving are paused until editing is finished or a new final task decision is made.",
    "lifecyclePendingLock": "Automatic locking is waiting for",
    "lifecyclePendingArchive": "Automatic archiving is waiting for",
    "lifecycleArchivedTasks": "Archived"
  }
};
