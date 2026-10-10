# Linguistic review evidence — 2026-10-10

This is the cumulative evidence record for the hash-bound interface-language review defined in `dev-notes/localization/LINGUISTIC_REVIEW.md`. A locale is recorded here only after all 2,244 runtime messages have been checked against the complete American-English source catalog and the current application context. The machine-readable manifest binds each completed review to both catalog hashes.

The review uses the source meaning, placeholders, Fylkren terminology, workflow context, destructive and security-sensitive wording, grammar, idiom, consistency, punctuation and regional conventions. Automated catalog and application tests verify completeness, placeholders, protected terms and runtime behavior; they supplement the semantic review rather than replace it.

## English (United Kingdom) — `en-GB`

- Source catalog: `en-US`, 2,244 messages, SHA-256 `4f8d4ddac684c6e2924bd13c1f5f9421cbd1474b7401278c5eec4e34f0429faa`.
- Scope: every runtime message, including shared strings, all domain sections and supplemental activity, AI, governance, intake, lifecycle, preservation, reference and sorting catalogs.
- Method: complete inheritance from the authoritative English source preserves meaning and placeholders. A catalog-wide regional conversion applies maintained British spelling, followed by explicit contextual overrides for organisation, federation catalogues, enquiries, cancellation and regional language labels. A regression scan rejects American spellings throughout the resulting runtime catalog.
- Terminology and style reference: Microsoft language resources and the Microsoft English (United Kingdom) style guide. Product terms and API/protocol names remain unchanged.
- Findings resolved: the previously partial regional catalog allowed American spellings to remain in inherited messages. The complete runtime catalog now consistently uses forms including `organisation`, `authorisation`, `synchronised`, `catalogue`, `licence`, `cancelled`, `prioritise`, `recognise`, `colour` and `artefact` where applicable.
- Verification: all 47 web test files and 177 tests passed; web TypeScript checking passed; the linguistic manifest and full catalog hash check passed.

The next locale is not marked complete in this record until its full catalog has undergone the same review.

## Norwegian Bokmål — `nb-NO`

- Source catalog: `en-US`, 2,244 messages, SHA-256 `4f8d4ddac684c6e2924bd13c1f5f9421cbd1474b7401278c5eec4e34f0429faa`.
- Reviewed catalog: SHA-256 `88251af60b4784681c4173011a54364471d74055511a6b87ce6ae87c56a1aea1`.
- Scope: every runtime message in the base catalog, all domain sections and every supplemental catalog.
- Method: key-by-key comparison with the English source and the corresponding Fylkren screen or workflow. The review separately covered identity and security, licensing, platform operations, email, appearance, organisation, Sites, personnel, work intake, tasks, planning, execution, decisions, risks and mitigation, reports, learning, audit, API and webhooks, federation, activity, lifecycle, preservation, references, sorting and AI assistance.
- Terminology reference: the Fylkren term base, Norwegian technical usage and Microsoft’s Norwegian security terminology. In particular, the interface now uses `tilgangsnøkkel` for passkey, while `sikkerhetsnøkkel` remains the physical-key term.
- Findings resolved: untranslated and unnatural interface wording; inconsistent leader names; `føderering` and `ruting`; `planleggingsflyt`; `revisjonslogg`; security-copy terminology; identity-provider field labels; preservation wording; and inconsistent use of `oppdrag` for the operational item versus `oppgave` for allocated work and page context.
- Verification: no empty or missing values; only legitimate shared spellings, protected product terms, protocol labels and placeholders remain identical to English. A catalog-wide regression scan rejects ordinary untranslated English interface vocabulary. All 47 web test files and 178 tests passed; web TypeScript checking passed; repository language boundaries, placeholders, protected terms and the linguistic manifest passed.
