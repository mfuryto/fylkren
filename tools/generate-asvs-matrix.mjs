import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node tools/generate-asvs-matrix.mjs <asvs-flat.json> <output.md>");
}

const expectedSha256 = "8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311";
const sourceBytes = await readFile(inputPath);
const actualSha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (actualSha256 !== expectedSha256) {
  throw new Error(`Unexpected ASVS source checksum: ${actualSha256}`);
}

const source = JSON.parse(sourceBytes.toString("utf8"));
const requirements = source.requirements.filter((requirement) => Number(requirement.L) <= 2);
const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const initialEvidence = new Map([
  ["V2.4.1", ["Pågår", "Innloggingsgrensen returnerer 429 etter gjentatte ugyldige forsøk; øvrige kostbare funksjoner gjenstår."]],
  ["V3.4.1", ["Pågår", "Offentlig kontroll: HSTS med max-age; full rutedekning gjenstår."]],
  ["V3.3.2", ["Bestått", "Session- og antiforgery-cookies bruker SameSite=Strict; den deployede sessiontesten verifiserer attributtet dynamisk."]],
  ["V3.5.1", ["Pågår", "Sentral middleware krever antiforgery-token for alle autentiserte nettlesermutasjoner under /api. DELETE uten token og med gyldig token er dynamisk verifisert; representative JSON- og multipartkall gjenstår."]],
  ["V3.5.2", ["Ikke relevant", "Fylkren bruker ikke CORS-preflight som CSRF-kontroll; alle autentiserte nettlesermutasjoner krever et bundet antiforgery-token i en egendefinert header."]],
  ["V3.5.4", ["Ikke relevant", "SPA og API er én applikasjon på samme origin. Fylkren er ikke vert for en separat applikasjon med en annen tillitsgrense på samme vertsnavn."]],
  ["V3.5.5", ["Ikke relevant", "Fylkren bruker ikke window.postMessage eller meldinger mellom nettleserorigins."]],
  ["V3.4.3", ["Pågår", "Offentlig kontroll: CSP finnes; direktivgjennomgang og full rutedekning gjenstår."]],
  ["V3.4.4", ["Pågår", "Offentlig kontroll: X-Content-Type-Options nosniff; full rutedekning gjenstår."]],
  ["V3.4.5", ["Pågår", "Offentlig kontroll: Referrer-Policy no-referrer; full rutedekning gjenstår."]],
  ["V3.4.6", ["Pågår", "Offentlig kontroll: CSP frame-ancestors; full rutedekning gjenstår."]],
  ["V4.3.1", ["Ikke relevant", "Løsningen eksponerer ikke GraphQL."]],
  ["V4.3.2", ["Ikke relevant", "Løsningen eksponerer ikke GraphQL."]],
  ["V4.4.1", ["Ikke relevant", "Løsningen bruker ikke WebSocket eller SignalR."]],
  ["V4.4.2", ["Ikke relevant", "Løsningen bruker ikke WebSocket eller SignalR."]],
  ["V4.4.3", ["Ikke relevant", "Løsningen bruker ikke WebSocket eller SignalR."]],
  ["V4.4.4", ["Ikke relevant", "Løsningen bruker ikke WebSocket eller SignalR."]],
  ["V5.1.1", ["Bestått", "Tillatte bildeformater, størrelsesgrenser, signaturkontroll, lagring og avvisningsatferd er dokumentert i docs/administration/ACCESS_AND_IDENTITY.md og docs/product/UI_AND_WHITE_LABEL.md."]],
  ["V5.2.1", ["Pågår", "Bilder begrenses til 2 MiB og hele forespørselskroppen til 3 MiB før domenebehandling; dynamisk grense- og belastningstest gjenstår."]],
  ["V5.2.2", ["Pågår", "Felles bildevalidator krever PNG-, JPEG- eller WebP-signatur som samsvarer med deklarert MIME-type; malformed- og polyglot-test gjenstår."]],
  ["V5.2.3", ["Ikke relevant", "Løsningen tar ikke imot arkiver eller komprimerte dokumentfiler."]],
  ["V5.3.1", ["Bestått", "Godkjente bilder lagres som databaseblobber og returneres med en fast detektert bildetype; de lagres aldri i en offentlig eller kjørbar mappe."]],
  ["V5.3.2", ["Ikke relevant", "Bilder lagres som databaseblobber uten klientstyrte filnavn eller filbaner; arbeidsdokumenter lagres ikke i løsningen."]],
  ["V5.4.1", ["Ikke relevant", "Løsningen tilbyr ikke nedlasting med brukerinnsendte filnavn; bilder returneres uten klientstyrt Content-Disposition-navn."]],
  ["V5.4.2", ["Ikke relevant", "Løsningen tilbyr ikke nedlasting med brukerinnsendte filnavn eller e-postvedlegg."]],
  ["V5.4.3", ["Pågår", "Opplastede bilder begrenses til tre signaturvaliderte bitmapformater og aktivt SVG-innhold avvises; verifikasjon mot kjente skadevareprøver eller kontrollert omskriving gjenstår."]],
  ["V6.1.1", ["Pågår", "Ratebegrensning for innlogging er dokumentert og dynamisk bekreftet; samlet anti-automatiseringsoversikt gjenstår."]],
  ["V6.2.1", ["Bestått", "Den felles passordpolicyen krever 14–128 tegn i alle lokale opprettings-, endrings- og tilbakestillingsflyter."]],
  ["V6.2.2", ["Bestått", "Innloggede lokale brukere kan endre eget passord fra profilen."]],
  ["V6.2.3", ["Bestått", "Passordendring krever både gjeldende og nytt passord; gjeldende hash verifiseres før endringen lagres."]],
  ["V6.4.1", ["Pågår", "128-bit aktiverings-/resetkode fra operativsystemets CSPRNG, 30 minutters utløp, atomisk engangsbruk og brukervalgt permanent passord er implementert. Samtidig gjenbruk er dynamisk avvist; utløpstidstesten gjenstår."]],
  ["V6.4.3", ["Pågår", "Passordreset endrer bare passordet og sikkerhetsversjonen; registrert TOTP forblir aktivt og kreves ved neste ordinære innlogging. Reset og øktinvalidering er dynamisk verifisert; MFA-samspillet gjenstår."]],
  ["V6.5.1", ["Pågår", "Samtidig gjenbruk av resetkode er dynamisk avvist og gjenopprettingskoder forbrukes serialisert per identitet; dynamisk replaytest av gjenopprettingskode gjenstår."]],
  ["V6.5.5", ["Bestått", "TOTP godtas bare i gjeldende 30-sekunders tidssteg; oppsetts- og innloggingsutfordringer utløper etter henholdsvis ti og fem minutter."]],
  ["V6.6.1", ["Ikke relevant", "Fylkren tilbyr ikke autentisering eller engangskoder via telefonnettet, taleanrop eller SMS."]],
  ["V7.1.1", ["Pågår", "Åtte timers inaktivitetsgrense og tolv timers absolutt levetid er dokumentert; risikobegrunnelse og IdP-samspill gjenstår."]],
  ["V7.2.4", ["Bestått", "Passordendring utsteder en ny økt med ny sikkerhetsversjon; en bevart parallell økt med den gamle versjonen avvises umiddelbart. Ordinær autentisering oppretter også en ny beskyttet ticket."]],
  ["V7.3.2", ["Pågår", "Absolutt tolv timers sessionlevetid håndheves; ordinær profilredigering kan ikke starte levetiden på nytt. Dynamisk gammel-ticket-test gjenstår."]],
  ["V7.2.3", ["Ikke relevant", "Nettlesersesjoner bruker dynamisk genererte, beskyttede selvstendige ASP.NET-cookies, ikke serverlagrede referansetokens."]],
  ["V7.4.2", ["Bestått", "Deaktivering øker sikkerhetsversjonen og hver autentiserte forespørsel kontrollerer identitet og aktiv tilgang. En bevart cookie avvises både under deaktivering og etter senere reaktivering."]],
  ["V7.4.3", ["Bestått", "Fylkren avslutter alltid alle andre økter etter passordbytte/reset eller endring av TOTP/WebAuthn via sikkerhetsversjonen. Dynamisk test bekrefter øktinvalidering ved passordbytte og reset."]],
  ["V10.2.2", ["Ikke relevant", "En installasjon kan bare ha én eksplisitt konfigurert OIDC-utsteder aktiv om gangen; klienten velger ikke mellom flere autorisasjonsservere i samme flyt."]],
  ["V10.3.1", ["Ikke relevant", "Fylkren eksponerer ikke en OAuth resource server og godtar ikke OAuth access tokens. Maskin-API-et bruker egne ugjennomsiktige, hashede Fylkren-legitimasjoner med eksplisitte scopes."]],
  ["V10.3.2", ["Ikke relevant", "Fylkren eksponerer ikke en OAuth resource server og godtar ikke OAuth access tokens. Maskin-API-et bruker egne ugjennomsiktige, hashede Fylkren-legitimasjoner med eksplisitte scopes."]],
  ["V10.3.3", ["Ikke relevant", "Fylkren eksponerer ikke en OAuth resource server og godtar ikke OAuth access tokens. Maskin-API-et bruker egne ugjennomsiktige, hashede Fylkren-legitimasjoner med eksplisitte scopes."]],
  ["V10.3.4", ["Ikke relevant", "Fylkren eksponerer ikke en OAuth resource server og godtar ikke OAuth access tokens. Maskin-API-et bruker egne ugjennomsiktige, hashede Fylkren-legitimasjoner med eksplisitte scopes."]],
  ...Array.from({ length: 11 }, (_, index) => [
    `V10.4.${index + 1}`,
    ["Ikke relevant", "Fylkren er ikke en OAuth-autorisasjonsserver og utsteder ikke OAuth authorization codes, access tokens eller refresh tokens til klienter."],
  ]),
  ["V10.5.5", ["Ikke relevant", "Fylkren støtter ikke OIDC back-channel logout og eksponerer derfor ikke et endepunkt som mottar logout tokens."]],
  ["V10.6.1", ["Ikke relevant", "Fylkren er en OIDC relying party, ikke en OpenID Provider, og utsteder ingen ID Tokens eller OIDC-autorisasjonssvar."]],
  ["V10.6.2", ["Ikke relevant", "Fylkren er en OIDC relying party, ikke en OpenID Provider, og utsteder ingen ID Tokens eller OIDC-autorisasjonssvar."]],
  ["V10.7.1", ["Ikke relevant", "Fylkren er ikke en OAuth-autorisasjonsserver og innhenter eller lagrer derfor ikke OAuth-samtykker på vegne av tredjepartsklienter."]],
  ["V10.7.2", ["Ikke relevant", "Fylkren er ikke en OAuth-autorisasjonsserver og innhenter eller lagrer derfor ikke OAuth-samtykker på vegne av tredjepartsklienter."]],
  ["V10.7.3", ["Ikke relevant", "Fylkren er ikke en OAuth-autorisasjonsserver og innhenter eller lagrer derfor ikke OAuth-samtykker på vegne av tredjepartsklienter."]],
  ["V12.1.1", ["Bestått", "TLS-test: 1.2 og 1.3 aksepteres, 1.0/1.1 avvises, standardforhandling velger 1.3, kjede og vertsnavn valideres."]],
  ["V12.1.3", ["Ikke relevant", "Fylkren bruker ikke mTLS-klientsertifikater som identitet eller autorisasjonsgrunnlag."]],
  ["V14.3.2", ["Pågår", "Offentlig konfigurasjon, anonym session og 401-svar har Cache-Control no-store."]],
  ["V15.3.4", ["Pågår", "Ratebegrensning er dynamisk bekreftet; proxytest med manipulerte forwarded-headere gjenstår."]],
  ["V16.5.1", ["Pågår", "Ukjent API-rute eksponerte ikke stacktrace eller implementasjonsdetaljer."]],
  ...["V17.1.1", "V17.2.1", "V17.2.2", "V17.2.3", "V17.2.4", "V17.3.1", "V17.3.2"].map((id) => [
    id,
    ["Ikke relevant", "Fylkren tilbyr ikke WebRTC, TURN, RTP/SRTP, medieserver eller WebRTC-signalering; kommunikasjon skjer over ordinær HTTPS."],
  ]),
]);

const lines = [
  "# ASVS 5.0.0 Level 2-sporbarhetsmatrise",
  "",
  "> Generert fra OWASP ASVS 5.0.0 flat JSON. Kravteksten er CC BY-SA 4.0. Status og bevis vedlikeholdes i Fylkren-repositoryet.",
  "",
  "Kilderevisjon: `v5.0.0`  ",
  "Forventet SHA-256: `8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311`",
  "",
  "Statusverdier: `Ikke vurdert`, `Pågår`, `Bestått`, `Ikke relevant`, `Avvik`.",
  "",
  "| Krav | Nivå | Område | Kravtekst | Status | Implementasjon/testbevis |",
  "| --- | ---: | --- | --- | --- | --- |",
  ...requirements.map((requirement) => {
    const [status, evidence] = initialEvidence.get(requirement.req_id) ?? ["Ikke vurdert", "–"];
    return `| v5.0.0-${escapeCell(requirement.req_id.slice(1))} | ${requirement.L} | ${escapeCell(requirement.chapter_name)} / ${escapeCell(requirement.section_name)} | ${escapeCell(requirement.req_description)} | ${status} | ${escapeCell(evidence)} |`;
  }),
  "",
];

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Generated ${requirements.length} Level 1/2 requirements in ${outputPath}`);
