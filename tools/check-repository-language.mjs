import { readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const norwegianCatalog = 'apps/web/src/localization/catalogs/nb-NO';
const checkerPath = 'tools/check-repository-language.mjs';
const checkedExtensions = new Set(['.cs', '.json', '.md', '.mjs', '.sh', '.ts', '.tsx', '.yaml', '.yml']);
const ignoredDirectories = new Set(['.git', '.git-local', 'backups', 'bin', 'dist', 'node_modules', 'obj', 'output', 'tmp']);
const norwegianCharacters = /[æøåÆØÅ]/g;
const norwegianWords = /\b(?:ikke|eller|skal|lagre|slette|slett|endre|opprette|opprett|oppdrag(?:et|ene|s)?|oppgave(?:n|r)?|anmodning(?:en|er)?|innstilling(?:er)?|språk|tidssone|målesystem|velg|velger|valgte|ingen|nettleser|pålogging|varsling(?:er)?|utførelse|godkjenning|godkjenn|planlegging|brukeren|siten|finnes|behandling|arbeidsnivå|sluttrapport|avventer|avvist|fullført|pågår|steg|stegnavn|plansteg|leder|ledelse|lederbeslutning|mottaker|mottatt|avsender|toppnivå|tilbake|lukk|åpne|skriv|svar|svarer|frist|tidligere|versjon|arbeidsflyt(?:er)?|beslutning(?:er)?|beslutningsgrunnlag|beskrivelse|enhet(?:en|er)?|underenhet(?:er)?|ansvarlig|bekreft|anbefaling|utkast|forvaltede|systemstyrt|laster|omfordel|tilgjengelig(?:e)?|dokumentasjon|fordelingstype|opprinnelig|kanselleringsgrunnlag|deaktivert|trukket|konfigurer|avslutt|riktig|tittel|navn|aktiv(?:e)?|kritisk|forrige|prioritet|forfalt|klassifisering|seksjon|annen|returner|viser|tomme|linjer|installasjon|containerstatus|eksporter|motpart(?:er)?|tilkobling|plattform|sammendrag|gjelder|dialogen|historikk|sider|lokal|fjern|legg|eksisterende|analyse|ekstern|hent|hoveddokument|identitet|instans|kapasitet|kjede|klient|kontroll|krever|kreves|ledig|mellom|oppdater|oversikt|revisjon|signert|ukjent|duplisert|fil|federert|federering|applikasjonen)\b/gi;

function allFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (ignoredDirectories.has(name)) continue;
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...allFiles(path));
    else if (checkedExtensions.has(extname(name))) files.push(path);
  }
  return files;
}

function markerCounts() {
  const counts = {};
  for (const absolutePath of allFiles(root)) {
    const path = relative(root, absolutePath);
    if (path === checkerPath || path === 'tools/repository-language-baseline.json' || path === norwegianCatalog || path.startsWith(`${norwegianCatalog}/`)) continue;
    const content = readFileSync(absolutePath, 'utf8');
    const count = (content.match(norwegianCharacters)?.length ?? 0) +
      (content.match(norwegianWords)?.length ?? 0);
    if (count) counts[path] = count;
  }
  return counts;
}

const current = markerCounts();
const findings = Object.entries(current)
  .filter(([, count]) => count > 0)
  .map(([path, count]) => `${path}: ${count} marker(s)`);
if (findings.length) {
  console.error(`Repository contains Norwegian outside ${norwegianCatalog}:`);
  for (const finding of findings.slice(0, 100)) console.error(`- ${finding}`);
  if (findings.length > 100) console.error(`- ... ${findings.length - 100} additional findings`);
  process.exitCode = 1;
} else {
  console.log(`Repository language check passed; Norwegian is confined to ${norwegianCatalog}.`);
}
