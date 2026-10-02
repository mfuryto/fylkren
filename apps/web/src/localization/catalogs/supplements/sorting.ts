export const sortingEn = {
  sortBy: "Sort by",
  sortNewest: "Newest first",
  sortOldest: "Oldest first",
  sortNameAscending: "Name A–Z",
  sortNameDescending: "Name Z–A",
  sortReferenceAscending: "Reference ascending",
  sortReferenceDescending: "Reference descending",
} as const;

export type SortingMessageKey = keyof typeof sortingEn;
type SortingMessages = Record<SortingMessageKey, string>;

export const sortingTranslations: Record<string, SortingMessages> = {
  "en-US": sortingEn,
  "en-GB": sortingEn,
  "nb-NO": { sortBy: "Sorter etter", sortNewest: "Nyeste først", sortOldest: "Eldste først", sortNameAscending: "Navn A–Å", sortNameDescending: "Navn Å–A", sortReferenceAscending: "Referanse stigende", sortReferenceDescending: "Referanse synkende" },
  "sv-SE": { sortBy: "Sortera efter", sortNewest: "Nyaste först", sortOldest: "Äldsta först", sortNameAscending: "Namn A–Ö", sortNameDescending: "Namn Ö–A", sortReferenceAscending: "Referens stigande", sortReferenceDescending: "Referens fallande" },
  "da-DK": { sortBy: "Sortér efter", sortNewest: "Nyeste først", sortOldest: "Ældste først", sortNameAscending: "Navn A–Å", sortNameDescending: "Navn Å–A", sortReferenceAscending: "Reference stigende", sortReferenceDescending: "Reference faldende" },
  "fi-FI": { sortBy: "Lajitteluperuste", sortNewest: "Uusimmat ensin", sortOldest: "Vanhimmat ensin", sortNameAscending: "Nimi A–Ö", sortNameDescending: "Nimi Ö–A", sortReferenceAscending: "Viite nousevasti", sortReferenceDescending: "Viite laskevasti" },
  "de-DE": { sortBy: "Sortieren nach", sortNewest: "Neueste zuerst", sortOldest: "Älteste zuerst", sortNameAscending: "Name A–Z", sortNameDescending: "Name Z–A", sortReferenceAscending: "Referenz aufsteigend", sortReferenceDescending: "Referenz absteigend" },
  "fr-FR": { sortBy: "Trier par", sortNewest: "Plus récents d’abord", sortOldest: "Plus anciens d’abord", sortNameAscending: "Nom A–Z", sortNameDescending: "Nom Z–A", sortReferenceAscending: "Référence croissante", sortReferenceDescending: "Référence décroissante" },
  "pl-PL": { sortBy: "Sortuj według", sortNewest: "Najnowsze najpierw", sortOldest: "Najstarsze najpierw", sortNameAscending: "Nazwa A–Z", sortNameDescending: "Nazwa Z–A", sortReferenceAscending: "Odwołanie rosnąco", sortReferenceDescending: "Odwołanie malejąco" },
  "es-ES": { sortBy: "Ordenar por", sortNewest: "Más recientes primero", sortOldest: "Más antiguos primero", sortNameAscending: "Nombre A–Z", sortNameDescending: "Nombre Z–A", sortReferenceAscending: "Referencia ascendente", sortReferenceDescending: "Referencia descendente" },
  "it-IT": { sortBy: "Ordina per", sortNewest: "Più recenti prima", sortOldest: "Meno recenti prima", sortNameAscending: "Nome A–Z", sortNameDescending: "Nome Z–A", sortReferenceAscending: "Riferimento crescente", sortReferenceDescending: "Riferimento decrescente" },
  "uk-UA": { sortBy: "Сортувати за", sortNewest: "Спочатку найновіші", sortOldest: "Спочатку найстаріші", sortNameAscending: "Назва А–Я", sortNameDescending: "Назва Я–А", sortReferenceAscending: "Посилання за зростанням", sortReferenceDescending: "Посилання за спаданням" },
  "nl-NL": { sortBy: "Sorteren op", sortNewest: "Nieuwste eerst", sortOldest: "Oudste eerst", sortNameAscending: "Naam A–Z", sortNameDescending: "Naam Z–A", sortReferenceAscending: "Referentie oplopend", sortReferenceDescending: "Referentie aflopend" },
  "pt-PT": { sortBy: "Ordenar por", sortNewest: "Mais recentes primeiro", sortOldest: "Mais antigos primeiro", sortNameAscending: "Nome A–Z", sortNameDescending: "Nome Z–A", sortReferenceAscending: "Referência crescente", sortReferenceDescending: "Referência decrescente" },
  "cs-CZ": { sortBy: "Řadit podle", sortNewest: "Nejnovější první", sortOldest: "Nejstarší první", sortNameAscending: "Název A–Z", sortNameDescending: "Název Z–A", sortReferenceAscending: "Reference vzestupně", sortReferenceDescending: "Reference sestupně" },
  "ro-RO": { sortBy: "Sortează după", sortNewest: "Cele mai noi întâi", sortOldest: "Cele mai vechi întâi", sortNameAscending: "Nume A–Z", sortNameDescending: "Nume Z–A", sortReferenceAscending: "Referință crescător", sortReferenceDescending: "Referință descrescător" },
  "et-EE": { sortBy: "Sortimisalus", sortNewest: "Uusimad ees", sortOldest: "Vanimad ees", sortNameAscending: "Nimi A–Z", sortNameDescending: "Nimi Z–A", sortReferenceAscending: "Viide kasvavalt", sortReferenceDescending: "Viide kahanevalt" },
  "lv-LV": { sortBy: "Kārtot pēc", sortNewest: "Jaunākie vispirms", sortOldest: "Vecākie vispirms", sortNameAscending: "Nosaukums A–Z", sortNameDescending: "Nosaukums Z–A", sortReferenceAscending: "Atsauce augoši", sortReferenceDescending: "Atsauce dilstoši" },
  "lt-LT": { sortBy: "Rikiuoti pagal", sortNewest: "Naujausi pirmiausia", sortOldest: "Seniausi pirmiausia", sortNameAscending: "Pavadinimas A–Z", sortNameDescending: "Pavadinimas Z–A", sortReferenceAscending: "Nuoroda didėjančiai", sortReferenceDescending: "Nuoroda mažėjančiai" },
};
