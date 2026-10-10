# Task type ordering — 2026-10-01

The task-type ordering rule was verified in a fresh, isolated Docker Compose deployment. The disposable database ran the complete migration chain, including `20261001160000_TranslateSystemDefaultsToEnglish`, before the API became healthy.

| Control | Result |
| --- | --- |
| Four task types created in a known sequence | The authenticated type endpoint returned them in reverse creation order, with the newest type first. |
| System-managed default type | The older default remained after the newly created types and retained its protection against editing. |
| Source types and senders | Their existing locale-aware alphabetical default remained intact. |
| Backup and restore | The restored deployment became healthy and retained the expected data. |
| Complete regression suite | `pnpm test:e2e:local` exited `0`; `lookupSorting` and every other reported scenario passed. |

The automated assertion is maintained in [`lookup-sorting.mjs`](../../../tools/e2e/lookup-sorting.mjs). The broader product requirement is that every user-facing data list exposes an appropriate sort control; default ordering does not replace that user choice.
